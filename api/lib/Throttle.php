<?php
declare(strict_types=1);

/**
 * Limitation des tentatives de connexion, stockée en fichiers :
 * aucune table à ajouter, fonctionne sur un mutualisé sans extension.
 */
final class Throttle
{
    private static function dossier(): string
    {
        $dossier = dirname(__DIR__) . '/storage/throttle';
        if (!is_dir($dossier) && !mkdir($dossier, 0770, true) && !is_dir($dossier)) {
            throw new RuntimeException("Impossible de créer le dossier $dossier.");
        }
        return $dossier;
    }

    private static function fichier(string $cle): string
    {
        return self::dossier() . '/' . sha1($cle) . '.json';
    }

    private static function lire(string $cle): array
    {
        $fichier = self::fichier($cle);
        if (!is_file($fichier)) {
            return ['echecs' => 0, 'jusqua' => 0];
        }
        $donnees = json_decode((string) file_get_contents($fichier), true);
        return is_array($donnees) ? $donnees + ['echecs' => 0, 'jusqua' => 0] : ['echecs' => 0, 'jusqua' => 0];
    }

    /** Bloque la requête si le quota d'échecs est dépassé. */
    public static function verifier(string $cle): void
    {
        $etat = self::lire($cle);
        if ($etat['jusqua'] > time()) {
            $minutes = (int) ceil(($etat['jusqua'] - time()) / 60);
            throw new HttpException(
                "Trop de tentatives. Réessayez dans $minutes minute" . ($minutes > 1 ? 's' : '') . '.',
                429
            );
        }
    }

    /**
     * Limite de débit sur une action réussie (création de commande publique) :
     * au plus $max actions par fenêtre de $duree secondes pour une même clé.
     */
    public static function limiter(string $cle, int $max, int $duree): void
    {
        $fichier = self::fichier($cle);
        $etat    = self::lire($cle);
        $maintenant = time();

        if (($etat['jusqua'] ?? 0) <= $maintenant) {
            $etat = ['echecs' => 0, 'compte' => 0, 'jusqua' => $maintenant + $duree];
        }

        $etat['compte'] = ($etat['compte'] ?? 0) + 1;
        file_put_contents($fichier, json_encode($etat), LOCK_EX);

        if ($etat['compte'] > $max) {
            throw new HttpException(
                'Trop de commandes envoyées depuis cet appareil. Contactez-nous directement sur WhatsApp.',
                429
            );
        }
    }

    public static function echec(string $cle): void
    {
        $etat   = self::lire($cle);
        $max    = (int) Config::get('securite.tentatives_max', 8);
        $duree  = (int) Config::get('securite.duree_blocage', 900);
        $etat['echecs']++;
        if ($etat['echecs'] >= $max) {
            $etat['jusqua'] = time() + $duree;
            $etat['echecs'] = 0;
        }
        file_put_contents(self::fichier($cle), json_encode($etat), LOCK_EX);
    }

    public static function reussite(string $cle): void
    {
        $fichier = self::fichier($cle);
        if (is_file($fichier)) {
            @unlink($fichier);
        }
    }
}
