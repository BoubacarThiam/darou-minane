<?php
declare(strict_types=1);

final class VarianteController
{
    private const PRIX_MAX = 99_999_999;

    /**
     * GET /admin/variantes — recherche d'articles pour la vente rapide.
     * Renvoie des VARIANTES (pas des produits) : c'est l'article que l'on
     * vend et que l'on décrémente. Recherche sur le nom du produit ou le SKU.
     */
    public static function index(Request $requete): void
    {
        Auth::exigerAuth($requete);

        $v = new Validator([
            'q'          => $requete->query('q'),
            'limite'     => $requete->query('limite'),
            'disponible' => $requete->query('disponible'),
        ]);
        $q          = $v->chaine('q', false, 0, 80);
        $limite     = (int) $v->entier('limite', false, 1, 50, 20);
        $disponible = $v->booleen('disponible', false);
        $v->valider();

        Response::json(Variante::rechercher($q, $limite, (bool) $disponible));
    }

    /** PUT /admin/variantes/{id} — la quantité n'est pas modifiable ici (module Stock). */
    public static function update(Request $requete, array $parametres): void
    {
        Auth::exigerProprietaire($requete);

        $v      = new Validator($requete->corps());
        $champs = [];
        if ($v->present('libelle'))      { $champs['libelle']      = $v->chaine('libelle', true, 1, 80); }
        if ($v->present('prix'))         { $champs['prix']         = $v->entier('prix', true, 0, self::PRIX_MAX); }
        if ($v->present('prix_achat'))   { $champs['prix_achat']   = $v->entier('prix_achat', false, 0, self::PRIX_MAX); }
        if ($v->present('seuil_alerte')) { $champs['seuil_alerte'] = $v->entier('seuil_alerte', true, 0, 100_000); }
        if ($v->present('position'))     { $champs['position']     = $v->entier('position', true, 0, 1000); }
        if ($v->present('actif'))        { $champs['actif']        = $v->booleen('actif', true); }
        if ($v->present('sku'))          { $champs['sku']          = $v->chaine('sku', true, 2, 40); }
        if ($v->present('quantite')) {
            $v->ajouterErreur('quantite', 'Le stock se modifie par un mouvement : POST /admin/stock/mouvements.');
        }
        $v->valider();

        Response::json(Variante::modifier(self::id($parametres), $champs));
    }

    /** DELETE /admin/variantes/{id} */
    public static function destroy(Request $requete, array $parametres): void
    {
        Auth::exigerProprietaire($requete);
        Response::json(Variante::retirer(self::id($parametres)));
    }

    private static function id(array $parametres): int
    {
        $id = (int) ($parametres['id'] ?? 0);
        if ($id < 1) {
            throw HttpException::introuvable('Identifiant de variante invalide.');
        }
        return $id;
    }
}
