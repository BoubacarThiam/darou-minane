<?php
declare(strict_types=1);

/**
 * Traitement des photos produits : contrôle du fichier réellement envoyé
 * (on ne fait jamais confiance à l'extension), redressement EXIF pour les
 * photos prises au téléphone, redimensionnement à la largeur maximale
 * configurée et sortie WebP (JPEG si l'hébergeur n'a pas WebP).
 * Objectif : une fiche produit qui reste consultable en 3G.
 */
final class ImageService
{
    private const TYPES_ACCEPTES = [
        IMAGETYPE_JPEG => 'jpeg',
        IMAGETYPE_PNG  => 'png',
        IMAGETYPE_WEBP => 'webp',
        IMAGETYPE_GIF  => 'gif',
    ];

    /** @return string chemin relatif au dossier uploads, ex. « 2026/09/a1b2c3.webp » */
    public static function enregistrer(array $fichier): string
    {
        self::verifierEnvoi($fichier);

        $infos = @getimagesize($fichier['tmp_name']);
        if ($infos === false || !isset(self::TYPES_ACCEPTES[$infos[2]])) {
            throw HttpException::validation(
                ['images' => 'Format non pris en charge. Formats acceptés : JPEG, PNG, WebP, GIF.']
            );
        }

        [$largeur, $hauteur, $type] = $infos;
        $source = match ($type) {
            IMAGETYPE_JPEG => imagecreatefromjpeg($fichier['tmp_name']),
            IMAGETYPE_PNG  => imagecreatefrompng($fichier['tmp_name']),
            IMAGETYPE_WEBP => imagecreatefromwebp($fichier['tmp_name']),
            IMAGETYPE_GIF  => imagecreatefromgif($fichier['tmp_name']),
        };
        if ($source === false) {
            throw HttpException::validation(['images' => 'Image illisible ou corrompue.']);
        }

        try {
            if ($type === IMAGETYPE_JPEG) {
                $source = self::redresser($source, $fichier['tmp_name']);
                $largeur  = imagesx($source);
                $hauteur  = imagesy($source);
            }

            $largeurMax = (int) Config::get('uploads.largeur_max', 1200);
            if ($largeur > $largeurMax) {
                $nouvelleHauteur = (int) round($hauteur * $largeurMax / $largeur);
                $redimensionnee  = imagecreatetruecolor($largeurMax, $nouvelleHauteur);
                imagealphablending($redimensionnee, false);
                imagesavealpha($redimensionnee, true);
                imagecopyresampled($redimensionnee, $source, 0, 0, 0, 0, $largeurMax, $nouvelleHauteur, $largeur, $hauteur);
                imagedestroy($source);
                $source = $redimensionnee;
            }

            return self::ecrire($source);
        } finally {
            if ($source instanceof GdImage) {
                imagedestroy($source);
            }
        }
    }

    private static function verifierEnvoi(array $fichier): void
    {
        $code = $fichier['error'] ?? UPLOAD_ERR_NO_FILE;
        if ($code !== UPLOAD_ERR_OK) {
            throw HttpException::validation(['images' => match ($code) {
                UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'Fichier trop volumineux.',
                UPLOAD_ERR_PARTIAL                        => 'Envoi interrompu, réessayez.',
                UPLOAD_ERR_NO_FILE                        => 'Aucun fichier reçu.',
                default                                   => "Échec de l'envoi du fichier.",
            }]);
        }
        if (!is_uploaded_file($fichier['tmp_name'])) {
            throw HttpException::interdit('Fichier non téléversé.');
        }
        $tailleMax = (int) Config::get('uploads.taille_max', 6 * 1024 * 1024);
        if (($fichier['size'] ?? 0) > $tailleMax) {
            $mo = round($tailleMax / 1048576, 1);
            throw HttpException::validation(['images' => "Fichier trop volumineux (maximum {$mo} Mo)."]);
        }
    }

    /** Applique l'orientation EXIF : une photo prise au téléphone arrive souvent couchée. */
    private static function redresser(GdImage $image, string $chemin): GdImage
    {
        if (!function_exists('exif_read_data')) {
            return $image;
        }
        $exif = @exif_read_data($chemin);
        $orientation = (int) ($exif['Orientation'] ?? 1);
        $angle = match ($orientation) {
            3 => 180,
            6 => -90,
            8 => 90,
            default => 0,
        };
        if ($angle === 0) {
            return $image;
        }
        $pivotee = imagerotate($image, $angle, 0);
        if ($pivotee === false) {
            return $image;
        }
        imagedestroy($image);
        return $pivotee;
    }

    private static function ecrire(GdImage $image): string
    {
        $qualite    = (int) Config::get('uploads.qualite', 82);
        $webp       = function_exists('imagewebp');
        $extension  = $webp ? 'webp' : 'jpg';
        $relatif    = date('Y/m') . '/' . bin2hex(random_bytes(8)) . '.' . $extension;
        $absolu     = self::dossierUploads() . '/' . $relatif;

        $dossier = dirname($absolu);
        if (!is_dir($dossier) && !mkdir($dossier, 0775, true) && !is_dir($dossier)) {
            throw new RuntimeException("Impossible de créer le dossier $dossier.");
        }

        if ($webp) {
            $ok = imagewebp($image, $absolu, $qualite);
        } else {
            // JPEG n'a pas de transparence : fond blanc pour éviter le noir.
            $fond = imagecreatetruecolor(imagesx($image), imagesy($image));
            imagefill($fond, 0, 0, imagecolorallocate($fond, 255, 255, 255));
            imagecopy($fond, $image, 0, 0, 0, 0, imagesx($image), imagesy($image));
            $ok = imagejpeg($fond, $absolu, $qualite);
            imagedestroy($fond);
        }
        if (!$ok) {
            throw new RuntimeException("Écriture de l'image impossible : $absolu");
        }
        @chmod($absolu, 0644);

        return $relatif;
    }

    /** Supprime un fichier du dossier uploads, en refusant toute sortie du dossier. */
    public static function supprimer(string $cheminRelatif): void
    {
        // Les visuels de démonstration sont partagés par le seed : on les garde.
        if (str_starts_with($cheminRelatif, 'demo/')) {
            return;
        }
        $base   = realpath(self::dossierUploads());
        $absolu = realpath(self::dossierUploads() . '/' . $cheminRelatif);
        if ($base === false || $absolu === false || !str_starts_with($absolu, $base . DIRECTORY_SEPARATOR)) {
            return;
        }
        @unlink($absolu);
    }

    public static function dossierUploads(): string
    {
        return rtrim((string) Config::get('uploads.dossier', dirname(__DIR__) . '/uploads'), '/');
    }

    public static function urlPublique(string $cheminRelatif): string
    {
        return rtrim((string) Config::get('uploads.url_publique', '/api/uploads'), '/') . '/' . ltrim($cheminRelatif, '/');
    }
}
