<?php
declare(strict_types=1);

/** Comptes du back-office — réservé au propriétaire. */
final class UtilisateurController
{
    /** GET /admin/utilisateurs */
    public static function index(Request $requete): void
    {
        Auth::exigerProprietaire($requete);
        Response::json(Utilisateur::liste());
    }

    /** POST /admin/utilisateurs */
    public static function store(Request $requete): void
    {
        Auth::exigerProprietaire($requete);

        $v          = new Validator($requete->corps());
        $nom        = $v->chaine('nom', true, 2, 100);
        $telephone  = $v->telephone('telephone', true);
        $motDePasse = $v->secret('mot_de_passe', true, 6);
        $role       = $v->parmi('role', ['proprietaire', 'employe'], false, 'employe');
        $v->valider();

        Response::json(
            Utilisateur::creer((string) $nom, (string) $telephone, (string) $motDePasse, (string) $role),
            201
        );
    }

    /** PUT /admin/utilisateurs/{id} */
    public static function update(Request $requete, array $parametres): void
    {
        $courant = Auth::exigerProprietaire($requete);
        $id      = self::id($parametres);

        $v      = new Validator($requete->corps());
        $champs = [];
        if ($v->present('nom'))          { $champs['nom']          = $v->chaine('nom', true, 2, 100); }
        if ($v->present('telephone'))    { $champs['telephone']    = $v->telephone('telephone', true); }
        if ($v->present('role'))         { $champs['role']         = $v->parmi('role', ['proprietaire', 'employe'], true); }
        if ($v->present('actif'))        { $champs['actif']        = $v->booleen('actif', true); }
        if ($v->present('mot_de_passe')) { $champs['mot_de_passe'] = $v->secret('mot_de_passe', true, 6); }
        $v->valider();

        self::protegerDernierProprietaire($id, $courant, $champs);

        Response::json(Utilisateur::modifier($id, $champs));
    }

    /** DELETE /admin/utilisateurs/{id} — désactivation, l'historique reste attribué. */
    public static function destroy(Request $requete, array $parametres): void
    {
        $courant = Auth::exigerProprietaire($requete);
        $id      = self::id($parametres);

        self::protegerDernierProprietaire($id, $courant, ['actif' => false]);

        Response::json(Utilisateur::modifier($id, ['actif' => false]));
    }

    /**
     * Empêche de se désactiver soi-même et de retirer le dernier compte
     * propriétaire actif : personne ne doit pouvoir se verrouiller dehors.
     */
    private static function protegerDernierProprietaire(int $id, array $courant, array $champs): void
    {
        $devientInactif = array_key_exists('actif', $champs) && $champs['actif'] === false;
        $perdLeRole     = array_key_exists('role', $champs) && $champs['role'] !== 'proprietaire';

        if ($id === $courant['id'] && ($devientInactif || $perdLeRole)) {
            throw HttpException::conflit('Vous ne pouvez pas désactiver ni rétrograder votre propre compte.');
        }

        if (($devientInactif || $perdLeRole) && Utilisateur::nombreProprietairesActifs() <= 1) {
            $cible = Utilisateur::parId($id);
            if ($cible !== null && $cible['role'] === 'proprietaire' && (int) $cible['actif'] === 1) {
                throw HttpException::conflit('Il doit rester au moins un compte propriétaire actif.');
            }
        }
    }

    private static function id(array $parametres): int
    {
        $id = (int) ($parametres['id'] ?? 0);
        if ($id < 1) {
            throw HttpException::introuvable('Identifiant de compte invalide.');
        }
        return $id;
    }
}
