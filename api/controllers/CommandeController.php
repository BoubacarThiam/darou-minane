<?php
declare(strict_types=1);

final class CommandeController
{
    /**
     * POST /admin/commandes — vente au comptoir.
     * Le canal est imposé côté serveur : cette route ne crée jamais une
     * commande « en ligne » (la boutique publique a son propre point d'entrée).
     */
    public static function venteComptoir(Request $requete): void
    {
        $utilisateur = Auth::exigerAuth($requete);

        $v      = new Validator($requete->corps());
        $lignes = $v->tableau('lignes', true, 1, 50);
        $donnees = [
            'canal'            => 'comptoir',
            'client_nom'       => $v->chaine('client_nom', false, 2, 120, 'Client comptoir'),
            'client_telephone' => $v->telephone('client_telephone', false),
            'client_note'      => $v->texte('client_note', false, 1000),
            'lignes'           => self::validerLignes($v, $lignes ?? []),
        ];
        $v->valider();

        Response::json(Commande::creer($donnees, $utilisateur['id']), 201);
    }

    /**
     * POST /commandes — commande passée depuis la boutique publique.
     *
     * Aucun compte, aucune session : le client laisse son nom, son téléphone
     * et un repère de livraison. Le canal est imposé côté serveur, la
     * commande naît « nouvelle » et non lue (badge du back-office).
     */
    public static function commandePublique(Request $requete): void
    {
        // Garde-fou anti-abus : dix commandes par heure et par appareil.
        Throttle::limiter('commande:' . sha1($requete->ip()), 10, 3600);

        $v      = new Validator($requete->corps());
        $lignes = $v->tableau('lignes', true, 1, 50);
        $donnees = [
            'canal'            => 'en_ligne',
            'client_nom'       => $v->chaine('client_nom', true, 2, 120),
            'client_telephone' => $v->telephone('client_telephone', true),
            'client_quartier'  => $v->chaine('client_quartier', true, 3, 150),
            'client_note'      => $v->texte('client_note', false, 1000),
            'mode_paiement'    => $v->parmi('mode_paiement', ['livraison', 'mobile_money'], false, 'livraison'),
            'lignes'           => self::validerLignes($v, $lignes ?? []),
        ];
        $email = $v->email('client_email');
        if ($donnees['mode_paiement'] === 'mobile_money' && !SasPay::actif()) {
            $v->ajouterErreur('mode_paiement', 'Le paiement mobile n\'est pas disponible : choisissez le paiement à la livraison.');
        } elseif ($donnees['mode_paiement'] === 'mobile_money' && $email === null && SasPay::emailRequis()) {
            $v->ajouterErreur('client_email', 'Indiquez votre e-mail : le service de paiement l\'exige pour vous envoyer le reçu.');
        }
        $v->valider();

        $commande = Commande::creer($donnees, null);

        // La commande est enregistrée, stock réservé : si SasPay ne répond
        // pas, on ne la perd pas pour autant, elle bascule en paiement à la
        // livraison et le client en est averti.
        $paiement = null;
        if ($donnees['mode_paiement'] === 'mobile_money') {
            try {
                $paiement = Paiement::ouvrir($commande, $email);
            } catch (RuntimeException $e) {
                error_log('[darou-minane] ' . $commande['reference'] . ' — ' . $e->getMessage());
                Database::requete("UPDATE commandes SET mode_paiement = 'livraison' WHERE id = ?", [$commande['id']]);
                $paiement = ['erreur' => 'Le paiement mobile est indisponible pour le moment. '
                    . 'Votre commande est bien enregistrée : vous paierez à la livraison.'];
            }
        }

        Response::json(self::vuePublique($commande) + ['paiement' => $paiement], 201);
    }

    /**
     * Ce que le client voit de sa commande — volontairement réduit : il n'a
     * pas à connaître les identifiants internes ni l'état de gestion.
     */
    public static function vuePublique(array $commande): array
    {
        return [
            'reference' => $commande['reference'],
            'total'     => $commande['total'],
            'lignes'    => array_map(static fn(array $l): array => [
                'libelle'       => $l['libelle'],
                'prix_unitaire' => $l['prix_unitaire'],
                'quantite'      => $l['quantite'],
                'total_ligne'   => $l['total_ligne'],
            ], $commande['lignes']),
            'livraison' => 'à convenir',
            'whatsapp'  => $commande['whatsapp']['boutique'],
        ];
    }

    /** GET /admin/commandes — liste filtrable. */
    public static function index(Request $requete): void
    {
        Auth::exigerAuth($requete);

        $v = new Validator([
            'statut'   => $requete->query('statut'),
            'canal'    => $requete->query('canal'),
            'q'        => $requete->query('q'),
            'non_vues' => $requete->query('non_vues'),
            'page'     => $requete->query('page'),
            'par_page' => $requete->query('par_page'),
        ]);
        $filtres = [
            'statut'   => $v->parmi('statut', Commande::STATUTS, false),
            'canal'    => $v->parmi('canal', ['en_ligne', 'comptoir'], false),
            'q'        => $v->chaine('q', false, 0, 80),
            'non_vues' => $v->booleen('non_vues'),
            'page'     => $v->entier('page', false, 1, 10_000, 1),
            'par_page' => $v->entier('par_page', false, 1, 100, 20),
        ];
        $v->valider();

        $resultat = Commande::liste($filtres);
        Response::liste($resultat['donnees'], $resultat['page'], $resultat['par_page'], $resultat['total']);
    }

    /**
     * GET /admin/commandes/{id}
     * Ouvrir une commande en ligne éteint son badge : « non vue » veut dire
     * « personne ne l'a encore regardée ».
     */
    public static function show(Request $requete, array $parametres): void
    {
        Auth::exigerAuth($requete);

        $id       = (int) ($parametres['id'] ?? 0);
        $commande = Commande::parId($id) ?? throw HttpException::introuvable('Commande introuvable.');

        if ($commande['canal'] === 'en_ligne' && !$commande['vue']) {
            Commande::marquerVue($id);
            $commande['vue'] = true;
        }

        // SasPay ne peut pas prévenir le site (voir lib/SasPay.php) : ouvrir
        // la commande est l'occasion de relire un paiement encore en attente.
        if (($commande['paiement']['statut'] ?? null) === 'en_attente') {
            $commande = self::relirePaiement($commande, false);
        }

        Response::json($commande);
    }

    /** POST /admin/commandes/{id}/paiement/verifier — bouton « Vérifier le paiement ». */
    public static function verifierPaiement(Request $requete, array $parametres): void
    {
        Auth::exigerAuth($requete);

        $commande = Commande::parId((int) ($parametres['id'] ?? 0))
            ?? throw HttpException::introuvable('Commande introuvable.');
        if ($commande['paiement'] === null) {
            throw HttpException::conflit('Cette commande se paie à la livraison.');
        }

        Response::json(self::relirePaiement($commande, true));
    }

    /**
     * Relit le paiement chez SasPay. Une panne réseau n'empêche pas
     * d'afficher la commande : on la renvoie telle quelle, signalée.
     */
    private static function relirePaiement(array $commande, bool $force): array
    {
        $paiement = Paiement::dernierDeCommande($commande['id']);
        if ($paiement === null) {
            return $commande;
        }
        try {
            Paiement::verifier($paiement, $force);
        } catch (RuntimeException $e) {
            error_log('[darou-minane] ' . $commande['reference'] . ' — ' . $e->getMessage());
            $commande['paiement']['injoignable'] = true;
            return $commande;
        }
        return Commande::parId($commande['id']) ?? $commande;
    }

    /** PUT /admin/commandes/{id}/statut */
    public static function changerStatut(Request $requete, array $parametres): void
    {
        $utilisateur = Auth::exigerAuth($requete);

        $v      = new Validator($requete->corps());
        $statut = $v->parmi('statut', Commande::STATUTS, true);
        $v->valider();

        Response::json(Commande::changerStatut((int) ($parametres['id'] ?? 0), (string) $statut, $utilisateur));
    }

    /**
     * GET /admin/notifications — sondé par le back-office pour le badge et
     * le signal sonore des nouvelles commandes en ligne.
     */
    public static function notifications(Request $requete): void
    {
        Auth::exigerAuth($requete);

        $nonVues = Commande::liste(['non_vues' => true, 'par_page' => 5]);

        Response::json([
            'non_vues'  => $nonVues['total'],
            'commandes' => $nonVues['donnees'],
        ]);
    }

    private static function validerLignes(Validator $v, array $lignes): array
    {
        $propres = [];
        foreach (array_values($lignes) as $index => $ligne) {
            if (!is_array($ligne)) {
                $v->ajouterErreur("lignes.$index", 'Ligne invalide.');
                continue;
            }
            $vl = new Validator($ligne);
            $propres[] = [
                'variante_id' => $vl->entier('variante_id', true, 1),
                'quantite'    => $vl->entier('quantite', true, 1, 10_000),
            ];
            try {
                $vl->valider();
            } catch (HttpException $e) {
                foreach ($e->champs() as $champ => $message) {
                    $v->ajouterErreur("lignes.$index.$champ", $message);
                }
            }
        }
        return $propres;
    }
}
