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
            'lignes'           => self::validerLignes($v, $lignes ?? []),
        ];
        $v->valider();

        $commande = Commande::creer($donnees, null);

        // Réponse volontairement réduite : le client n'a pas à connaître
        // les identifiants internes ni l'état de gestion de la boutique.
        Response::json([
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
        ], 201);
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

        Response::json($commande);
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
