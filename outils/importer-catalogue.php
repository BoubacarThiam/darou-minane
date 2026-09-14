<?php
declare(strict_types=1);

/**
 * Import du catalogue réel depuis un lot de photos.
 *
 *   php outils/importer-catalogue.php [chemin/vers/manifeste.json]
 *
 * Les produits sont créés en BROUILLON (actif = 0) au prix 0 : rien n'est
 * publié tant que le propriétaire n'a pas saisi ses prix et ses quantités
 * dans le back-office. Les photos passent par le même traitement que celles
 * envoyées depuis l'application (redressement EXIF, 1200 px, WebP).
 *
 * Le script est rejouable : un produit dont le slug existe déjà est ignoré.
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
        if (is_file($fichier)) {
            require $fichier;
            return;
        }
    }
});

$manifesteChemin = $argv[1] ?? $racine . '/outils/catalogue-photos.json';
if (!is_file($manifesteChemin)) {
    exit("Manifeste introuvable : $manifesteChemin\n");
}

$manifeste = json_decode((string) file_get_contents($manifesteChemin), true);
if (!is_array($manifeste) || !isset($manifeste['produits'])) {
    exit("Manifeste illisible : $manifesteChemin\n");
}

$dossierPhotos = rtrim($manifeste['dossier_photos'] ?? '', '/');

/** Retrouve une catégorie par son nom, la crée si elle manque. */
function categorieId(string $nom): int
{
    static $cache = [];
    if (isset($cache[$nom])) {
        return $cache[$nom];
    }
    foreach (Categorie::toutes() as $categorie) {
        if (mb_strtolower($categorie['nom']) === mb_strtolower($nom)) {
            return $cache[$nom] = $categorie['id'];
        }
    }
    $creee = Categorie::creer($nom, 100);
    echo "  + catégorie « $nom » créée\n";
    return $cache[$nom] = $creee['id'];
}

$importes = 0;
$ignores  = 0;
$photos   = 0;
$erreurs  = [];

foreach ($manifeste['produits'] as $ligne) {
    $nom  = $ligne['nom'];
    $slug = Slug::creer($nom);

    if (Database::unique('SELECT id FROM produits WHERE slug = ?', [$slug]) !== null) {
        echo "= $nom (déjà présent)\n";
        $ignores++;
        continue;
    }

    try {
        $produit = Produit::creer([
            'categorie_id' => categorieId($ligne['categorie']),
            'nom'          => $nom,
            'description'  => $ligne['description'] ?? null,
            'actif'        => false,   // brouillon : invisible dans la boutique
            'mis_en_avant' => false,
            'variantes'    => array_map(static fn(array $v): array => [
                'libelle'      => $v['libelle'],
                'prix'         => 0,   // à fixer dans le back-office
                'quantite'     => 0,
                'seuil_alerte' => 2,
            ], $ligne['variantes']),
        ], null);

        // Photos générales du produit, puis photos propres à chaque variante.
        $aPlacer = array_map(
            static fn(string $fichier): array => ['fichier' => $fichier, 'variante_id' => null],
            $ligne['photos'] ?? []
        );
        foreach ($ligne['variantes'] as $index => $variante) {
            foreach ($variante['photos'] ?? [] as $fichier) {
                $aPlacer[] = ['fichier' => $fichier, 'variante_id' => $produit['variantes'][$index]['id']];
            }
        }

        foreach ($aPlacer as $element) {
            $chemin = ImageService::importer("$dossierPhotos/{$element['fichier']}");
            ImageProduit::creer($produit['id'], $chemin, $element['variante_id'], null);
            $photos++;
        }

        echo "+ $nom — " . count($ligne['variantes']) . " variante(s), " . count($aPlacer) . " photo(s)\n";
        $importes++;
    } catch (Throwable $e) {
        $erreurs[] = "$nom : " . $e->getMessage();
        echo "! $nom — " . $e->getMessage() . "\n";
    }
}

echo "\n";
echo "Produits importés : $importes\n";
echo "Déjà présents     : $ignores\n";
echo "Photos traitées   : $photos\n";
if ($erreurs !== []) {
    echo "Erreurs :\n  - " . implode("\n  - ", $erreurs) . "\n";
}
echo "\nLes produits sont en brouillon, au prix 0. Ouvrez le back-office,\n";
echo "saisissez les prix et les quantités, puis cochez « Visible dans la boutique ».\n";
