<?php
declare(strict_types=1);

/**
 * Écrit les versions réduites des photos déjà en place.
 *
 *   php outils/generer-declinaisons.php [--forcer]
 *
 * Depuis qu'ImageService écrit ses déclinaisons à l'envoi, seules les photos
 * importées avant cette évolution n'en ont pas. Ce script les rattrape.
 *
 * Il est rejouable : une déclinaison déjà présente est laissée telle quelle,
 * sauf avec --forcer.
 */

if (PHP_SAPI !== 'cli') {
    exit("À lancer en ligne de commande.\n");
}

$racine = dirname(__DIR__);
require $racine . '/api/lib/Config.php';
Config::charger($racine . '/api/config.php');
spl_autoload_register(static function (string $classe) use ($racine): void {
    foreach (['lib', 'models', 'controllers'] as $dossier) {
        $fichier = "$racine/api/$dossier/$classe.php";
        if (is_file($fichier)) { require $fichier; return; }
    }
});

$forcer  = in_array('--forcer', $argv, true);
$dossier = ImageService::dossierUploads();
$images  = Database::toutes('SELECT DISTINCT chemin FROM images_produit ORDER BY chemin');

$ecrites = 0;
$sautees = 0;
$avant   = 0;
$apres   = 0;
$erreurs = [];

foreach ($images as $ligne) {
    $relatif = $ligne['chemin'];
    // Les visuels de démonstration sont des SVG : rien à redimensionner.
    if (str_starts_with($relatif, 'demo/')) {
        continue;
    }
    $source = "$dossier/$relatif";
    if (!is_file($source)) {
        $erreurs[] = "introuvable : $relatif";
        continue;
    }

    $infos = @getimagesize($source);
    if ($infos === false) {
        $erreurs[] = "illisible : $relatif";
        continue;
    }
    $avant += filesize($source);

    $image = @imagecreatefromwebp($source) ?: @imagecreatefromjpeg($source);
    if ($image === false) {
        $erreurs[] = "décodage impossible : $relatif";
        continue;
    }

    $largeur = imagesx($image);
    $hauteur = imagesy($image);
    $qualite = (int) Config::get('uploads.qualite', 82);

    foreach (ImageService::LARGEURS as $cible) {
        if ($largeur <= $cible) {
            continue;
        }
        $chemin = "$dossier/" . ImageService::cheminDecline($relatif, $cible);
        if (!$forcer && is_file($chemin)) {
            $sautees++;
            $apres += filesize($chemin);
            continue;
        }
        $hauteurCible = (int) round($hauteur * $cible / $largeur);
        $reduite = imagecreatetruecolor($cible, $hauteurCible);
        imagealphablending($reduite, false);
        imagesavealpha($reduite, true);
        imagecopyresampled($reduite, $image, 0, 0, 0, 0, $cible, $hauteurCible, $largeur, $hauteur);
        if (@imagewebp($reduite, $chemin, $qualite)) {
            @chmod($chemin, 0644);
            $ecrites++;
            $apres += filesize($chemin);
        } else {
            $erreurs[] = "écriture impossible : $chemin";
        }
        imagedestroy($reduite);
    }
    imagedestroy($image);
}

printf("Photos passées en revue : %d\n", count($images));
printf("Déclinaisons écrites    : %d\n", $ecrites);
printf("Déjà présentes          : %d\n", $sautees);
printf("Poids des originales    : %.2f Mo\n", $avant / 1048576);
printf("Poids des déclinaisons  : %.2f Mo\n", $apres / 1048576);
if ($erreurs !== []) {
    echo "Erreurs :\n  - " . implode("\n  - ", $erreurs) . "\n";
}
