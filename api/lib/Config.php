<?php
declare(strict_types=1);

/**
 * Accès en lecture seule au fichier config.php.
 * Convention du projet : les classes d'infrastructure (lib/) sont en anglais,
 * les classes de domaine (models/) portent les noms métier français.
 */
final class Config
{
    private static ?array $valeurs = null;

    public static function charger(string $chemin): void
    {
        if (!is_file($chemin)) {
            throw new RuntimeException(
                "Fichier de configuration introuvable : $chemin — copier api/config.example.php en api/config.php."
            );
        }
        self::$valeurs = require $chemin;
    }

    /** @param string $cle chemin pointé, ex. « boutique.whatsapp » */
    public static function get(string $cle, mixed $defaut = null): mixed
    {
        $courant = self::$valeurs ?? [];
        foreach (explode('.', $cle) as $segment) {
            if (!is_array($courant) || !array_key_exists($segment, $courant)) {
                return $defaut;
            }
            $courant = $courant[$segment];
        }
        return $courant;
    }

    public static function estDeveloppement(): bool
    {
        return self::get('app.env') === 'developpement';
    }
}
