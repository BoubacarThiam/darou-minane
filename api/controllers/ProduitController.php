<?php
declare(strict_types=1);

/**
 * Catalogue côté back-office.
 * Lecture : propriétaire et employé (l'employé ne reçoit pas les prix d'achat,
 * filtrés dans Variante::presenter()). Écriture : propriétaire seulement.
 */
final class ProduitController
{
    private const PRIX_MAX = 99_999_999;

    /** GET /admin/produits */
    public static function index(Request $requete): void
    {
        Auth::exigerAuth($requete);

        $v = new Validator([
            'q'            => $requete->query('q'),
            'categorie_id' => $requete->query('categorie_id'),
            'actif'        => $requete->query('actif'),
            'sous_seuil'   => $requete->query('sous_seuil'),
            'page'         => $requete->query('page'),
            'par_page'     => $requete->query('par_page'),
        ]);
        $filtres = [
            'q'            => $v->chaine('q', false, 0, 80),
            'categorie_id' => $v->entier('categorie_id', false, 1),
            'actif'        => $v->booleen('actif'),
            'sous_seuil'   => $v->booleen('sous_seuil'),
            'page'         => $v->entier('page', false, 1, 10000, 1),
            'par_page'     => $v->entier('par_page', false, 1, 100, 20),
        ];
        $v->valider();

        $resultat = Produit::listeAdmin($filtres);
        Response::liste($resultat['donnees'], $resultat['page'], $resultat['par_page'], $resultat['total']);
    }

    /** GET /admin/produits/{id} */
    public static function show(Request $requete, array $parametres): void
    {
        Auth::exigerAuth($requete);
        Response::json(Produit::ficheAdmin(self::id($parametres)));
    }

    /** POST /admin/produits */
    public static function store(Request $requete): void
    {
        $utilisateur = Auth::exigerProprietaire($requete);
        $corps       = $requete->corps();

        $v = new Validator($corps);
        $donnees = [
            'categorie_id' => $v->entier('categorie_id', true, 1),
            'nom'          => $v->chaine('nom', true, 2, 150),
            'description'  => $v->texte('description', false, 5000),
            'mis_en_avant' => $v->booleen('mis_en_avant', false),
            'actif'        => $v->booleen('actif', true),
        ];
        $variantes = $v->tableau('variantes', true, 1, 30);
        $donnees['variantes'] = self::validerVariantes($v, $variantes ?? []);
        $v->valider();

        Response::json(Produit::creer($donnees, $utilisateur['id']), 201);
    }

    /** PUT /admin/produits/{id} */
    public static function update(Request $requete, array $parametres): void
    {
        Auth::exigerProprietaire($requete);
        $corps = $requete->corps();

        $v      = new Validator($corps);
        $champs = [];
        if ($v->present('categorie_id')) { $champs['categorie_id'] = $v->entier('categorie_id', true, 1); }
        if ($v->present('nom'))          { $champs['nom']          = $v->chaine('nom', true, 2, 150); }
        if ($v->present('description'))  { $champs['description']  = $v->texte('description', false, 5000); }
        if ($v->present('prix_base'))    { $champs['prix_base']    = $v->entier('prix_base', true, 0, self::PRIX_MAX); }
        if ($v->present('mis_en_avant')) { $champs['mis_en_avant'] = $v->booleen('mis_en_avant', false); }
        if ($v->present('actif'))        { $champs['actif']        = $v->booleen('actif', true); }
        if ($v->present('slug'))         { $champs['slug']         = $v->chaine('slug', false, 2, 150); }
        $v->valider();

        Response::json(Produit::modifier(self::id($parametres), $champs));
    }

    /** DELETE /admin/produits/{id} */
    public static function destroy(Request $requete, array $parametres): void
    {
        Auth::exigerProprietaire($requete);
        Response::json(Produit::retirer(self::id($parametres)));
    }

    /** POST /admin/produits/{id}/variantes */
    public static function ajouterVariante(Request $requete, array $parametres): void
    {
        $utilisateur = Auth::exigerProprietaire($requete);

        $v       = new Validator($requete->corps());
        $donnees = [
            'libelle'      => $v->chaine('libelle', true, 1, 80),
            'prix'         => $v->entier('prix', true, 0, self::PRIX_MAX),
            'prix_achat'   => $v->entier('prix_achat', false, 0, self::PRIX_MAX),
            'quantite'     => $v->entier('quantite', false, 0, 1_000_000, 0),
            'seuil_alerte' => $v->entier('seuil_alerte', false, 0, 100_000, 3),
            'sku'          => $v->chaine('sku', false, 2, 40),
            'actif'        => $v->booleen('actif', true),
        ];
        $v->valider();

        Response::json(Variante::creer(self::id($parametres), $donnees, $utilisateur['id']), 201);
    }

    /**
     * Valide le tableau de variantes reçu à la création d'un produit.
     * Les erreurs sont remontées champ par champ : « variantes.0.prix ».
     */
    private static function validerVariantes(Validator $v, array $variantes): array
    {
        $propres = [];
        foreach (array_values($variantes) as $index => $variante) {
            if (!is_array($variante)) {
                $v->ajouterErreur("variantes.$index", 'Variante invalide.');
                continue;
            }
            $vv = new Validator($variante);
            $propres[] = [
                'libelle'      => $vv->chaine('libelle', true, 1, 80),
                'prix'         => $vv->entier('prix', true, 0, self::PRIX_MAX),
                'prix_achat'   => $vv->entier('prix_achat', false, 0, self::PRIX_MAX),
                'quantite'     => $vv->entier('quantite', false, 0, 1_000_000, 0),
                'seuil_alerte' => $vv->entier('seuil_alerte', false, 0, 100_000, 3),
                'sku'          => $vv->chaine('sku', false, 2, 40),
            ];
            try {
                $vv->valider();
            } catch (HttpException $e) {
                foreach ($e->champs() as $champ => $message) {
                    $v->ajouterErreur("variantes.$index.$champ", $message);
                }
            }
        }
        return $propres;
    }

    private static function id(array $parametres): int
    {
        $id = (int) ($parametres['id'] ?? 0);
        if ($id < 1) {
            throw HttpException::introuvable('Identifiant de produit invalide.');
        }
        return $id;
    }
}
