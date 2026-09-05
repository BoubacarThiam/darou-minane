<?php
declare(strict_types=1);

final class CategorieController
{
    /** POST /admin/categories */
    public static function store(Request $requete): void
    {
        Auth::exigerProprietaire($requete);

        $v     = new Validator($requete->corps());
        $nom   = $v->chaine('nom', true, 2, 80);
        $ordre = $v->entier('ordre', false, 0, 10_000, 0);
        $v->valider();

        Response::json(Categorie::creer((string) $nom, $ordre), 201);
    }

    /** PUT /admin/categories/{id} */
    public static function update(Request $requete, array $parametres): void
    {
        Auth::exigerProprietaire($requete);

        $v      = new Validator($requete->corps());
        $champs = [];
        if ($v->present('nom'))   { $champs['nom']   = $v->chaine('nom', true, 2, 80); }
        if ($v->present('ordre')) { $champs['ordre'] = $v->entier('ordre', true, 0, 10_000); }
        $v->valider();

        Response::json(Categorie::modifier(self::id($parametres), $champs));
    }

    /** DELETE /admin/categories/{id} — refusée si la catégorie contient des produits. */
    public static function destroy(Request $requete, array $parametres): void
    {
        Auth::exigerProprietaire($requete);
        Categorie::supprimer(self::id($parametres));
        Response::vide();
    }

    private static function id(array $parametres): int
    {
        $id = (int) ($parametres['id'] ?? 0);
        if ($id < 1) {
            throw HttpException::introuvable('Identifiant de catégorie invalide.');
        }
        return $id;
    }
}
