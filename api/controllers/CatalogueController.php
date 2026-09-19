<?php
declare(strict_types=1);

/**
 * Boutique publique : lecture seule, sans compte. Aucune de ces réponses
 * ne contient de prix d'achat, de SKU ni de quantité chiffrée — seulement
 * « en stock » ou non.
 */
final class CatalogueController
{
    /** GET /boutique — informations d'enseigne consommées par le front. */
    public static function boutique(Request $requete): void
    {
        Response::cachePublic(300);
        Response::json([
            'nom'            => Config::get('boutique.nom'),
            'slogan'         => Config::get('boutique.slogan'),
            'whatsapp'       => Config::get('boutique.whatsapp'),
            'zone_livraison' => Config::get('boutique.zone_livraison'),
            'devise'         => Config::get('boutique.devise'),
            'livraison'      => 'à convenir',
            // Vrai dès qu'une clé SasPay est configurée : la boutique propose
            // alors Wave, Orange Money et Free Money en plus des espèces.
            'paiement_mobile' => SasPay::actif(),
            'paiement_email_requis' => SasPay::actif() && SasPay::emailRequis(),
        ]);
    }

    /** GET /categories */
    public static function categories(Request $requete): void
    {
        Response::cachePublic(120);
        Response::json(Categorie::toutes(true));
    }

    /** GET /produits */
    public static function produits(Request $requete): void
    {
        $v = new Validator([
            'q'            => $requete->query('q'),
            'categorie'    => $requete->query('categorie'),
            'prix_min'     => $requete->query('prix_min'),
            'prix_max'     => $requete->query('prix_max'),
            'tri'          => $requete->query('tri'),
            'mis_en_avant' => $requete->query('mis_en_avant'),
            'page'         => $requete->query('page'),
            'par_page'     => $requete->query('par_page'),
        ]);

        $filtres = [
            'q'            => $v->chaine('q', false, 0, 80),
            'categorie'    => $v->chaine('categorie', false, 0, 80),
            'prix_min'     => $v->entier('prix_min', false, 0),
            'prix_max'     => $v->entier('prix_max', false, 0),
            'tri'          => $v->parmi('tri', ['recent', 'nom', 'prix_asc', 'prix_desc'], false, 'recent'),
            'mis_en_avant' => $v->booleen('mis_en_avant'),
            'page'         => $v->entier('page', false, 1, 10000, 1),
            'par_page'     => $v->entier('par_page', false, 1, 60, 12),
        ];
        $v->valider();

        Response::cachePublic(60);
        $resultat = Produit::listePublique($filtres);
        Response::liste($resultat['donnees'], $resultat['page'], $resultat['par_page'], $resultat['total']);
    }

    /** GET /produits/{slug} */
    public static function produit(Request $requete, array $parametres): void
    {
        Response::cachePublic(60);
        Response::json(Produit::fichePublique($parametres['slug']));
    }
}
