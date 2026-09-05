<?php
declare(strict_types=1);

final class Response
{
    private static bool $cachePublic = false;

    /**
     * Autorise la mise en cache d'une réponse publique (catalogue).
     * Sur une connexion 3G, une minute de cache évite un aller-retour
     * complet quand le client revient sur une page déjà vue.
     */
    public static function cachePublic(int $secondes = 60): void
    {
        self::$cachePublic = true;
        if (!headers_sent()) {
            header("Cache-Control: public, max-age=$secondes, stale-while-revalidate=300");
        }
    }

    public static function json(mixed $donnees, int $statut = 200): void
    {
        http_response_code($statut);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        if (!headers_sent() && !self::$cachePublic) {
            // Données de gestion et réponses authentifiées : jamais en cache.
            header('Cache-Control: no-store');
        }
        echo json_encode($donnees, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    public static function vide(): void
    {
        http_response_code(204);
    }

    public static function erreur(string $message, int $statut = 400, array $champs = []): void
    {
        $charge = ['erreur' => $message];
        if ($champs !== []) {
            $charge['champs'] = $champs;
        }
        self::json($charge, $statut);
    }

    /** Enveloppe standard des listes paginées. */
    public static function liste(array $donnees, int $page, int $parPage, int $total): void
    {
        self::json([
            'donnees'    => $donnees,
            'pagination' => [
                'page'     => $page,
                'par_page' => $parPage,
                'total'    => $total,
                'pages'    => $parPage > 0 ? (int) ceil($total / $parPage) : 1,
            ],
        ]);
    }
}
