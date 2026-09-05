<?php
declare(strict_types=1);

final class AuthController
{
    /** POST /auth/connexion */
    public static function connexion(Request $requete): void
    {
        $v         = new Validator($requete->corps());
        $telephone = $v->telephone('telephone', true);
        $motDePasse = $v->secret('mot_de_passe', true, 4);
        $v->valider();

        $utilisateur = Auth::connecter((string) $telephone, (string) $motDePasse, $requete->ip());

        Response::json([
            'utilisateur' => $utilisateur,
            'csrf_token'  => Auth::jetonCsrf(),
        ]);
    }

    /** GET /auth/moi — sert aussi à rafraîchir le jeton CSRF au chargement du back-office. */
    public static function moi(Request $requete): void
    {
        $utilisateur = Auth::utilisateur();
        Response::json([
            'utilisateur' => $utilisateur,
            'csrf_token'  => $utilisateur !== null ? Auth::jetonCsrf() : null,
        ]);
    }

    /** POST /auth/deconnexion */
    public static function deconnexion(Request $requete): void
    {
        Auth::exigerAuth($requete);
        Auth::deconnecter();
        Response::vide();
    }

    /** PUT /auth/mot-de-passe — chacun change son propre mot de passe. */
    public static function changerMotDePasse(Request $requete): void
    {
        $utilisateur = Auth::exigerAuth($requete);

        $v       = new Validator($requete->corps());
        $actuel  = $v->secret('mot_de_passe_actuel', true, 4);
        $nouveau = $v->secret('nouveau_mot_de_passe', true, 6);
        $v->valider();

        $ligne = Utilisateur::parId($utilisateur['id']) ?? throw HttpException::nonAutorise();
        if (!password_verify((string) $actuel, $ligne['mot_de_passe_hash'])) {
            throw HttpException::validation(['mot_de_passe_actuel' => 'Mot de passe actuel incorrect.']);
        }

        Utilisateur::changerMotDePasse($utilisateur['id'], (string) $nouveau);
        Response::json(['message' => 'Mot de passe modifié.']);
    }
}
