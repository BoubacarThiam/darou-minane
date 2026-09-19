<?php
declare(strict_types=1);

/**
 * Paiement mobile money des commandes en ligne, par SasPay.
 *
 * Une commande payée par mobile money reste une commande ordinaire : même
 * stock réservé, mêmes étapes de livraison. Le paiement n'ajoute qu'une
 * information — l'argent est-il déjà reçu ? — et seule une relecture chez
 * SasPay peut l'établir. Le navigateur du client ne fait que demander
 * cette relecture ; il ne peut jamais déclarer lui-même une commande payée.
 */
final class Paiement
{
    /** Deux relectures automatiques d'un même paiement sont espacées d'au moins 15 s. */
    private const INTERVALLE_VERIFICATION = 15;

    /**
     * Ouvre la page de paiement SasPay d'une commande et renvoie l'adresse
     * où envoyer le client. Lève RuntimeException si SasPay refuse ou ne
     * répond pas : la commande, elle, est déjà enregistrée.
     *
     * @return array{url: string, jeton: string}
     */
    public static function ouvrir(array $commande, ?string $email): array
    {
        $site = rtrim((string) Config::get('app.url_publique', ''), '/');
        if ($site === '') {
            throw new RuntimeException('app.url_publique manquante dans config.php : pas d\'adresse de retour.');
        }

        // Le jeton est le seul secret du lien de retour : 128 bits aléatoires,
        // la référence CMD-AAAA-NNNN se devinant trop facilement.
        $jeton   = bin2hex(random_bytes(16));
        $session = SasPay::creerSession([
            'amount'         => number_format((int) $commande['total'], 2, '.', ''),
            'currency'       => 'XOF',
            'country'        => 'SN',
            'description'    => sprintf('%s — commande %s', Config::get('boutique.nom'), $commande['reference']),
            'customer_name'  => $commande['client_nom'],
            // SasPay exige un e-mail (pour le reçu) ; le client n'est pas tenu
            // d'en avoir un : on se rabat alors sur celui de la boutique.
            'customer_email' => $email ?? (string) Config::get('paiement.saspay.email_par_defaut', ''),
            'customer_phone' => $commande['client_telephone'] ? '+' . $commande['client_telephone'] : '',
            'return_url'     => $site . '/commande/paiement?j=' . $jeton,
            'metadata'       => ['commande' => $commande['reference']],
        ]);

        $url = (string) $session['checkout_url'];
        if (!str_starts_with($url, 'https://') && !Config::estDeveloppement()) {
            throw new RuntimeException('SasPay : adresse de paiement non sécurisée refusée.');
        }

        Database::requete(
            'INSERT INTO paiements (commande_id, session_id, jeton, checkout_url, email, montant)
             VALUES (?, ?, ?, ?, ?, ?)',
            [(int) $commande['id'], (string) $session['id'], $jeton, $url, $email, (int) $commande['total']]
        );

        return ['url' => $url, 'jeton' => $jeton];
    }

    public static function parJeton(string $jeton): ?array
    {
        if (preg_match('/^[a-f0-9]{32}$/', $jeton) !== 1) {
            return null;
        }
        return Database::unique('SELECT * FROM paiements WHERE jeton = ?', [$jeton]);
    }

    /** Dernière tentative de paiement d'une commande, ou null. */
    public static function dernierDeCommande(int $commandeId): ?array
    {
        return Database::unique(
            'SELECT * FROM paiements WHERE commande_id = ? ORDER BY id DESC LIMIT 1',
            [$commandeId]
        );
    }

    /**
     * Relit chez SasPay un paiement encore en attente et enregistre ce qui a
     * changé. Renvoie le paiement à jour. Sans $force, un paiement relu il y
     * a moins de 15 s est rendu tel quel (le back-office peut rouvrir la
     * commande en boucle sans marteler SasPay).
     */
    public static function verifier(array $paiement, bool $force = false): array
    {
        if ($paiement['statut'] !== 'en_attente') {
            return $paiement;
        }
        if (!$force && $paiement['verifie_le'] !== null && (bool) Database::valeur(
            'SELECT ? > NOW() - INTERVAL ' . self::INTERVALLE_VERIFICATION . ' SECOND',
            [$paiement['verifie_le']]
        )) {
            return $paiement;
        }

        $id      = (int) $paiement['id'];
        $session = SasPay::session((string) $paiement['session_id']);
        $etat    = strtoupper((string) ($session['status'] ?? ''));

        if ($etat === 'PAID' && self::sessionConforme($session, (int) $paiement['montant'])) {
            $transactionId = self::idTransaction($session['transaction'] ?? null);
            if ($transactionId !== null) {
                $transaction = SasPay::transaction($transactionId);
                if (strtoupper((string) ($transaction['status'] ?? '')) === 'SUCCESS') {
                    self::enregistrerPaye($paiement, $transactionId, $transaction);
                    return self::parId($id);
                }
            }
        } elseif ($etat === 'EXPIRED' || $etat === 'CANCELLED') {
            Database::requete(
                "UPDATE paiements SET statut = ?, verifie_le = NOW() WHERE id = ? AND statut = 'en_attente'",
                [$etat === 'EXPIRED' ? 'expire' : 'annule', $id]
            );
            return self::parId($id);
        }

        Database::requete('UPDATE paiements SET verifie_le = NOW() WHERE id = ?', [$id]);
        return self::parId($id);
    }

    /**
     * La session relue doit être celle que le serveur a créée : même montant,
     * en francs CFA. Le client ne peut pas la modifier, mais un écart
     * signalerait une erreur de configuration qu'on ne doit pas encaisser
     * en silence.
     */
    private static function sessionConforme(array $session, int $montant): bool
    {
        $conforme = strtoupper((string) ($session['currency'] ?? '')) === 'XOF'
            && (int) round((float) ($session['amount'] ?? -1)) === $montant;
        if (!$conforme) {
            error_log(sprintf(
                '[darou-minane] session SasPay %s non conforme : %s %s au lieu de %d XOF',
                $session['id'] ?? '?',
                $session['amount'] ?? '?',
                $session['currency'] ?? '?',
                $montant
            ));
        }
        return $conforme;
    }

    /** Le champ « transaction » d'une session : un identifiant, ou l'objet complet. */
    private static function idTransaction(mixed $transaction): ?string
    {
        if (is_array($transaction)) {
            $transaction = $transaction['id'] ?? null;
        }
        return is_string($transaction) && $transaction !== '' ? $transaction : null;
    }

    private static function enregistrerPaye(array $paiement, string $transactionId, array $transaction): void
    {
        // Le net n'a de sens qu'en francs CFA (une carte bancaire est réglée en USD).
        $net = strtoupper((string) ($transaction['currency'] ?? '')) === 'XOF' && isset($transaction['net_amount'])
            ? (int) round((float) $transaction['net_amount'])
            : null;

        $enregistre = Database::transaction(static function (PDO $pdo) use ($paiement, $transactionId, $transaction, $net): bool {
            $stmt = $pdo->prepare('SELECT statut FROM paiements WHERE id = ? FOR UPDATE');
            $stmt->execute([(int) $paiement['id']]);
            if ($stmt->fetchColumn() !== 'en_attente') {
                return false; // une vérification simultanée l'a déjà enregistré
            }

            $pdo->prepare(
                "UPDATE paiements
                    SET statut = 'paye', transaction_id = ?, reference_externe = ?, montant_net = ?,
                        paye_le = NOW(), verifie_le = NOW()
                  WHERE id = ?"
            )->execute([$transactionId, $transaction['reference'] ?? null, $net, (int) $paiement['id']]);

            $pdo->prepare('UPDATE commandes SET paye_en_ligne_le = NOW() WHERE id = ? AND paye_en_ligne_le IS NULL')
                ->execute([(int) $paiement['commande_id']]);
            return true;
        });

        if ($enregistre) {
            error_log(sprintf(
                '[darou-minane] paiement mobile reçu : commande #%d, %d FCFA, transaction %s',
                (int) $paiement['commande_id'],
                (int) $paiement['montant'],
                $transaction['reference'] ?? $transactionId
            ));
        }
    }

    private static function parId(int $id): array
    {
        return Database::unique('SELECT * FROM paiements WHERE id = ?', [$id])
            ?? throw new RuntimeException("Paiement #$id introuvable.");
    }

    /** Ce que le back-office affiche d'un paiement (jamais le jeton du client). */
    public static function presenter(?array $paiement): ?array
    {
        if ($paiement === null) {
            return null;
        }
        return [
            'statut'            => $paiement['statut'],
            'montant'           => (int) $paiement['montant'],
            'montant_net'       => $paiement['montant_net'] !== null ? (int) $paiement['montant_net'] : null,
            'reference_externe' => $paiement['reference_externe'],
            'paye_le'           => $paiement['paye_le'],
            'verifie_le'        => $paiement['verifie_le'],
            'created_at'        => $paiement['created_at'],
        ];
    }
}
