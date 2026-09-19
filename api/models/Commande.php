<?php
declare(strict_types=1);

/**
 * Commandes — vente comptoir (back-office) et commande en ligne (boutique).
 *
 * Une commande se crée en une seule transaction : numérotation, lignes au
 * prix figé, et sortie de stock par des mouvements « vente ». Si une seule
 * ligne manque de stock, rien n'est écrit.
 */
final class Commande
{
    public const STATUTS = ['nouvelle', 'confirmee', 'en_livraison', 'livree', 'payee', 'annulee'];

    /**
     * @param array{canal: string, client_nom?: ?string, client_telephone?: ?string,
     *              client_quartier?: ?string, client_note?: ?string, mode_paiement?: string,
     *              lignes: array<int, array{variante_id: int, quantite: int}>} $donnees
     */
    public static function creer(array $donnees, ?int $utilisateurId): array
    {
        $canal  = $donnees['canal'];
        $lignes = self::fusionnerLignes($donnees['lignes']);

        $id = Database::transaction(static function (PDO $pdo) use ($donnees, $lignes, $canal, $utilisateurId): int {
            $reference = self::genererReference($pdo);
            $statut    = $canal === 'comptoir' ? 'payee' : 'nouvelle';

            $pdo->prepare(
                'INSERT INTO commandes
                    (reference, canal, client_nom, client_telephone, client_quartier, client_note,
                     statut, mode_paiement, total, vue, utilisateur_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)'
            )->execute([
                $reference,
                $canal,
                $donnees['client_nom'] ?? 'Client comptoir',
                $donnees['client_telephone'] ?? null,
                $donnees['client_quartier'] ?? null,
                $donnees['client_note'] ?? null,
                $statut,
                $donnees['mode_paiement'] ?? 'livraison',
                $canal === 'comptoir' ? 1 : 0,   // une vente comptoir n'a rien à signaler
                $utilisateurId,
            ]);
            $commandeId = (int) $pdo->lastInsertId();

            $total = 0;
            $insertLigne = $pdo->prepare(
                'INSERT INTO lignes_commande (commande_id, variante_id, libelle_fige, prix_unitaire, quantite)
                 VALUES (?, ?, ?, ?, ?)'
            );

            foreach ($lignes as $varianteId => $quantite) {
                $article = self::verrouillerArticle($pdo, $varianteId);

                $insertLigne->execute([
                    $commandeId,
                    $varianteId,
                    $article['libelle_fige'],
                    $article['prix'],
                    $quantite,
                ]);
                $total += $article['prix'] * $quantite;

                Stock::appliquer(
                    $pdo,
                    $varianteId,
                    'vente',
                    -$quantite,
                    ($canal === 'comptoir' ? 'Vente comptoir ' : 'Commande ') . $reference,
                    $commandeId,
                    $utilisateurId
                );
            }

            $pdo->prepare('UPDATE commandes SET total = ? WHERE id = ?')->execute([$total, $commandeId]);

            return $commandeId;
        });

        $creee = self::parId($id) ?? throw new RuntimeException('Commande non créée.');

        // Une commande en ligne doit se signaler : badge du back-office
        // (vue = 0) et point d'extension unique pour un envoi WhatsApp/SMS.
        if ($canal === 'en_ligne') {
            Notifier::nouvelleCommande($creee);
        }

        return $creee;
    }

    /**
     * Le prix et le libellé sont lus dans la transaction, la variante déjà
     * verrouillée : ce qui est facturé est ce qui était en base à la vente.
     */
    private static function verrouillerArticle(PDO $pdo, int $varianteId): array
    {
        $stmt = $pdo->prepare(
            'SELECT v.prix, v.libelle, v.actif AS variante_active, p.nom, p.actif AS produit_actif
               FROM variantes v JOIN produits p ON p.id = v.produit_id
              WHERE v.id = ?
              FOR UPDATE'
        );
        $stmt->execute([$varianteId]);
        $article = $stmt->fetch();

        if ($article === false) {
            throw HttpException::validation(['lignes' => "Article #$varianteId introuvable."]);
        }
        if ((int) $article['variante_active'] !== 1 || (int) $article['produit_actif'] !== 1) {
            throw HttpException::conflit(
                sprintf('%s — %s n\'est plus en vente.', $article['nom'], $article['libelle'])
            );
        }

        return [
            'prix'         => (int) $article['prix'],
            'libelle_fige' => $article['nom'] . ' — ' . $article['libelle'],
        ];
    }

    /** Numérotation CMD-AAAA-NNNN, sans trou ni doublon (compteur verrouillé). */
    private static function genererReference(PDO $pdo): string
    {
        $annee = (int) date('Y');

        $pdo->prepare(
            'INSERT INTO compteurs_commandes (annee, dernier_numero) VALUES (?, 0)
             ON DUPLICATE KEY UPDATE annee = annee'
        )->execute([$annee]);

        $stmt = $pdo->prepare('SELECT dernier_numero FROM compteurs_commandes WHERE annee = ? FOR UPDATE');
        $stmt->execute([$annee]);
        $numero = (int) $stmt->fetchColumn() + 1;

        $pdo->prepare('UPDATE compteurs_commandes SET dernier_numero = ? WHERE annee = ?')
            ->execute([$numero, $annee]);

        return sprintf('CMD-%d-%04d', $annee, $numero);
    }

    /**
     * Deux fois le même article dans le panier = une seule ligne cumulée
     * (la base l'impose, et une facture avec deux lignes identiques est fausse).
     * @return array<int, int> variante_id => quantité
     */
    private static function fusionnerLignes(array $lignes): array
    {
        $fusionnees = [];
        foreach ($lignes as $ligne) {
            $varianteId = (int) $ligne['variante_id'];
            $quantite   = (int) $ligne['quantite'];
            $fusionnees[$varianteId] = ($fusionnees[$varianteId] ?? 0) + $quantite;
        }
        if ($fusionnees === []) {
            throw HttpException::validation(['lignes' => 'Le panier est vide.']);
        }
        return $fusionnees;
    }

    /**
     * Enchaînement autorisé des statuts. Une commande annulée est terminale :
     * on ne « désannule » pas, on refait une commande.
     */
    public const TRANSITIONS = [
        'nouvelle'     => ['confirmee', 'en_livraison', 'annulee'],
        'confirmee'    => ['en_livraison', 'livree', 'annulee'],
        'en_livraison' => ['livree', 'annulee'],
        'livree'       => ['payee', 'annulee'],
        'payee'        => ['annulee'],
        'annulee'      => [],
    ];

    /**
     * Change le statut. Le passage à « annulee » restitue le stock par des
     * mouvements « retour », dans la même transaction que le changement.
     *
     * @param array{id: int, role: string} $utilisateur
     */
    public static function changerStatut(int $id, string $statut, array $utilisateur): array
    {
        Database::transaction(static function (PDO $pdo) use ($id, $statut, $utilisateur): void {
            $stmt = $pdo->prepare('SELECT id, reference, statut, paye_en_ligne_le FROM commandes WHERE id = ? FOR UPDATE');
            $stmt->execute([$id]);
            $commande = $stmt->fetch();
            if ($commande === false) {
                throw HttpException::introuvable('Commande introuvable.');
            }

            $actuel = $commande['statut'];
            if ($actuel === $statut) {
                return;
            }
            if (!in_array($statut, self::TRANSITIONS[$actuel] ?? [], true)) {
                throw HttpException::conflit(sprintf(
                    'Une commande « %s » ne peut pas passer à « %s ».',
                    self::libelleStatut($actuel),
                    self::libelleStatut($statut)
                ));
            }

            // Annuler une vente déjà encaissée, c'est rendre de l'argent —
            // au comptoir comme par mobile money.
            $encaissee = $actuel === 'payee' || $commande['paye_en_ligne_le'] !== null;
            if ($statut === 'annulee' && $encaissee && $utilisateur['role'] !== 'proprietaire') {
                throw HttpException::interdit('Seul le propriétaire annule une commande déjà payée.');
            }

            // Livrer une commande déjà payée par mobile money la termine :
            // il ne reste rien à encaisser, « Marquer payée » n'aurait pas de sens.
            if ($statut === 'livree' && $commande['paye_en_ligne_le'] !== null) {
                $statut = 'payee';
            }

            if ($statut === 'annulee') {
                self::restituerStock($pdo, (int) $commande['id'], $commande['reference'], $utilisateur['id']);
            }

            $pdo->prepare('UPDATE commandes SET statut = ? WHERE id = ?')->execute([$statut, $id]);
        });

        return self::parId($id) ?? throw new RuntimeException('Commande introuvable.');
    }

    /** Remet en stock chaque ligne d'une commande annulée. */
    private static function restituerStock(PDO $pdo, int $commandeId, string $reference, ?int $utilisateurId): void
    {
        $stmt = $pdo->prepare('SELECT variante_id, quantite FROM lignes_commande WHERE commande_id = ?');
        $stmt->execute([$commandeId]);

        foreach ($stmt->fetchAll() as $ligne) {
            if ($ligne['variante_id'] === null) {
                continue; // variante supprimée depuis : rien à restituer
            }
            Stock::appliquer(
                $pdo,
                (int) $ligne['variante_id'],
                'retour',
                (int) $ligne['quantite'],
                'Annulation de la commande ' . $reference,
                $commandeId,
                $utilisateurId
            );
        }
    }

    /** Le badge du back-office compte les commandes en ligne jamais ouvertes. */
    public static function marquerVue(int $id): void
    {
        Database::requete('UPDATE commandes SET vue = 1 WHERE id = ? AND vue = 0', [$id]);
    }

    public static function nombreNonVues(): int
    {
        return (int) Database::valeur(
            "SELECT COUNT(*) FROM commandes WHERE vue = 0 AND canal = 'en_ligne'"
        );
    }

    /**
     * @param array{statut?: ?string, canal?: ?string, q?: ?string,
     *              non_vues?: ?bool, page?: int, par_page?: int} $filtres
     */
    public static function liste(array $filtres): array
    {
        $conditions = ['1 = 1'];
        $params     = [];

        if (!empty($filtres['statut'])) {
            $conditions[] = 'c.statut = ?';
            $params[]     = $filtres['statut'];
        }
        if (!empty($filtres['canal'])) {
            $conditions[] = 'c.canal = ?';
            $params[]     = $filtres['canal'];
        }
        if (!empty($filtres['non_vues'])) {
            $conditions[] = "c.vue = 0 AND c.canal = 'en_ligne'";
        }
        if (!empty($filtres['q'])) {
            $motif        = '%' . str_replace(['%', '_'], ['\\%', '\\_'], (string) $filtres['q']) . '%';
            $conditions[] = '(c.reference LIKE ? OR c.client_nom LIKE ? OR c.client_telephone LIKE ?)';
            $params[]     = $motif;
            $params[]     = $motif;
            $params[]     = $motif;
        }

        $where   = 'WHERE ' . implode(' AND ', $conditions);
        $page    = max(1, (int) ($filtres['page'] ?? 1));
        $parPage = min(100, max(1, (int) ($filtres['par_page'] ?? 20)));

        $total = (int) Database::valeur("SELECT COUNT(*) FROM commandes c $where", $params);

        $lignes = Database::toutes(
            "SELECT c.*, u.nom AS vendeur_nom,
                    (SELECT COALESCE(SUM(l.quantite), 0) FROM lignes_commande l WHERE l.commande_id = c.id) AS nb_articles
               FROM commandes c
          LEFT JOIN utilisateurs u ON u.id = c.utilisateur_id
              $where
           ORDER BY c.created_at DESC, c.id DESC
              LIMIT " . (int) $parPage . ' OFFSET ' . (int) (($page - 1) * $parPage),
            $params
        );

        return [
            'donnees'  => array_map(
                static fn(array $l): array => self::presenter($l, false) + ['nb_articles' => (int) $l['nb_articles']],
                $lignes
            ),
            'page'     => $page,
            'par_page' => $parPage,
            'total'    => $total,
        ];
    }

    public static function libelleStatut(string $statut): string
    {
        return [
            'nouvelle'     => 'nouvelle',
            'confirmee'    => 'confirmée',
            'en_livraison' => 'en livraison',
            'livree'       => 'livrée',
            'payee'        => 'payée',
            'annulee'      => 'annulée',
        ][$statut] ?? $statut;
    }

    public static function parId(int $id): ?array
    {
        $ligne = Database::unique(
            'SELECT c.*, u.nom AS vendeur_nom
               FROM commandes c LEFT JOIN utilisateurs u ON u.id = c.utilisateur_id
              WHERE c.id = ?',
            [$id]
        );
        return $ligne === null ? null : self::presenter($ligne, true);
    }

    public static function presenter(array $ligne, bool $avecLignes): array
    {
        $commande = [
            'id'               => (int) $ligne['id'],
            'reference'        => $ligne['reference'],
            'canal'            => $ligne['canal'],
            'statut'           => $ligne['statut'],
            'mode_paiement'    => $ligne['mode_paiement'],
            'paye_en_ligne_le' => $ligne['paye_en_ligne_le'],
            'total'            => (int) $ligne['total'],
            'vue'              => (bool) $ligne['vue'],
            'client_nom'       => $ligne['client_nom'],
            'client_telephone' => $ligne['client_telephone'],
            'client_quartier'  => $ligne['client_quartier'],
            'client_note'      => $ligne['client_note'],
            'vendeur'          => $ligne['vendeur_nom'] ?? null,
            'created_at'       => $ligne['created_at'],
        ];

        if ($avecLignes) {
            $commande['transitions'] = self::TRANSITIONS[$ligne['statut']] ?? [];
            $commande['lignes'] = array_map(static fn(array $l): array => [
                'id'            => (int) $l['id'],
                'variante_id'   => $l['variante_id'] !== null ? (int) $l['variante_id'] : null,
                'produit_id'    => $l['produit_id'] !== null ? (int) $l['produit_id'] : null,
                'libelle'       => $l['libelle_fige'],
                'prix_unitaire' => (int) $l['prix_unitaire'],
                'quantite'      => (int) $l['quantite'],
                'total_ligne'   => (int) $l['total_ligne'],
                'image'         => $l['image'] !== null ? ImageService::urlPublique($l['image']) : null,
                'image_srcset'  => $l['image'] !== null ? ImageService::srcset($l['image']) : null,
            ], Database::toutes(
                // Le libellé et le prix restent ceux figés à la commande ; seule
                // la photo vient du catalogue actuel. Si la déclinaison a été
                // supprimée depuis, la jointure ne trouve rien et la ligne
                // s'affiche sans photo, sans casser la commande.
                'SELECT l.*, v.produit_id,
                        (SELECT i.chemin FROM images_produit i
                          WHERE i.produit_id = v.produit_id
                       ORDER BY (i.variante_id = l.variante_id) DESC, i.position
                          LIMIT 1) AS image
                   FROM lignes_commande l
              LEFT JOIN variantes v ON v.id = l.variante_id
                  WHERE l.commande_id = ?
               ORDER BY l.id',
                [(int) $ligne['id']]
            ));
        }

        if ($avecLignes) {
            $commande['whatsapp'] = Notifier::liensCommande($commande);
            $commande['paiement'] = $ligne['mode_paiement'] === 'mobile_money'
                ? Paiement::presenter(Paiement::dernierDeCommande((int) $ligne['id']))
                : null;
        }

        return $commande;
    }
}
