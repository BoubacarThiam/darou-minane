<?php
declare(strict_types=1);

final class TableauDeBordController
{
    /** GET /admin/tableau-de-bord */
    public static function index(Request $requete): void
    {
        $utilisateur = Auth::exigerAuth($requete);
        Response::json(TableauDeBord::resume($utilisateur['role'] === 'proprietaire'));
    }
}
