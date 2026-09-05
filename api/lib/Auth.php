<?php
declare(strict_types=1);

/**
 * Authentification par session PHP + cookie httpOnly.
 *
 * Trois règles :
 *  - la session n'est démarrée que si un cookie existe déjà (les visiteurs
 *    de la boutique publique ne créent aucun fichier de session) ;
 *  - le rôle est relu en base à chaque requête : désactiver un employé le
 *    déconnecte immédiatement ;
 *  - toute requête d'écriture authentifiée exige le jeton CSRF de la session.
 */
final class Auth
{
    private static ?array $cache = null;
    private static bool $verifie = false;

    public static function demarrerSession(bool $forcer = false): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }
        $nom = (string) Config::get('securite.nom_session', 'darou_session');
        if (!$forcer && !isset($_COOKIE[$nom])) {
            return;
        }

        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

        session_name($nom);
        session_set_cookie_params([
            'lifetime' => 0,
            'path'     => '/',
            'domain'   => '',
            'secure'   => $https,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();

        $duree = (int) Config::get('securite.duree_session', 28800);
        if (isset($_SESSION['derniere_activite']) && (time() - (int) $_SESSION['derniere_activite']) > $duree) {
            self::deconnecter();
            return;
        }
        $_SESSION['derniere_activite'] = time();
    }

    public static function connecter(string $telephone, string $motDePasse, string $ip): array
    {
        $cle = 'connexion:' . sha1($telephone . '|' . $ip);
        Throttle::verifier($cle);

        $utilisateur = Utilisateur::parTelephone($telephone);
        $valide = $utilisateur !== null
            && (int) $utilisateur['actif'] === 1
            && password_verify($motDePasse, $utilisateur['mot_de_passe_hash']);

        if (!$valide) {
            Throttle::echec($cle);
            usleep(300_000); // ralentit le balayage de mots de passe
            throw new HttpException('Téléphone ou mot de passe incorrect.', 401);
        }
        Throttle::reussite($cle);

        if (password_needs_rehash($utilisateur['mot_de_passe_hash'], PASSWORD_DEFAULT)) {
            Utilisateur::changerMotDePasse((int) $utilisateur['id'], $motDePasse);
        }

        self::demarrerSession(true);
        session_regenerate_id(true);
        $_SESSION = [
            'uid'               => (int) $utilisateur['id'],
            'csrf'              => bin2hex(random_bytes(32)),
            'derniere_activite' => time(),
        ];
        Utilisateur::marquerConnexion((int) $utilisateur['id']);
        self::$cache = null;
        self::$verifie = false;

        return self::utilisateur() ?? throw new RuntimeException('Session non initialisée.');
    }

    public static function deconnecter(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            $_SESSION = [];
            if (ini_get('session.use_cookies')) {
                $p = session_get_cookie_params();
                setcookie(session_name(), '', [
                    'expires'  => time() - 42000,
                    'path'     => $p['path'],
                    'domain'   => $p['domain'],
                    'secure'   => $p['secure'],
                    'httponly' => $p['httponly'],
                    'samesite' => $p['samesite'] ?? 'Lax',
                ]);
            }
            session_destroy();
        }
        self::$cache = null;
        self::$verifie = true;
    }

    /** @return array{id:int, nom:string, telephone:string, role:string}|null */
    public static function utilisateur(): ?array
    {
        if (self::$verifie) {
            return self::$cache;
        }
        self::$verifie = true;

        if (session_status() !== PHP_SESSION_ACTIVE || empty($_SESSION['uid'])) {
            return self::$cache = null;
        }

        $utilisateur = Utilisateur::parId((int) $_SESSION['uid']);
        if ($utilisateur === null || (int) $utilisateur['actif'] !== 1) {
            self::deconnecter();
            self::$verifie = true;
            return self::$cache = null;
        }

        return self::$cache = [
            'id'        => (int) $utilisateur['id'],
            'nom'       => $utilisateur['nom'],
            'telephone' => $utilisateur['telephone'],
            'role'      => $utilisateur['role'],
        ];
    }

    public static function jetonCsrf(): ?string
    {
        return session_status() === PHP_SESSION_ACTIVE ? ($_SESSION['csrf'] ?? null) : null;
    }

    /**
     * Exige un compte connecté et, sur les écritures, un jeton CSRF valide.
     * Toutes les routes du back-office passent par cette porte.
     */
    public static function exigerAuth(Request $requete): array
    {
        $utilisateur = self::utilisateur();
        if ($utilisateur === null) {
            throw HttpException::nonAutorise();
        }
        if ($requete->estEcriture()) {
            $jeton = $requete->entete('X-CSRF-Token') ?? '';
            $attendu = self::jetonCsrf() ?? '';
            if ($attendu === '' || !hash_equals($attendu, $jeton)) {
                throw HttpException::interdit('Jeton CSRF absent ou invalide.');
            }
        }
        return $utilisateur;
    }

    /** Réservé au propriétaire : prix d'achat, marges, catalogue, comptes. */
    public static function exigerProprietaire(Request $requete): array
    {
        $utilisateur = self::exigerAuth($requete);
        if ($utilisateur['role'] !== 'proprietaire') {
            throw HttpException::interdit('Réservé au propriétaire.');
        }
        return $utilisateur;
    }

    public static function estProprietaire(): bool
    {
        return (self::utilisateur()['role'] ?? null) === 'proprietaire';
    }
}
