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

/**
 * Photos d'une entrée du manifeste : celles du produit, puis celles qui
 * appartiennent à une variante précise.
 *
 * @param array $variantes variantes en base, dans l'ordre du manifeste
 * @return array<int, array{fichier: string, variante_id: ?int}>
 */
function photosDuProduit(array $ligne, array $variantes): array
{
    $liste = array_map(
        static fn(string $fichier): array => ['fichier' => $fichier, 'variante_id' => null],
        $ligne['photos'] ?? []
    );
    foreach ($ligne['variantes'] as $index => $variante) {
        foreach ($variante['photos'] ?? [] as $fichier) {
            $liste[] = [
                'fichier'     => $fichier,
                'variante_id' => isset($variantes[$index]) ? (int) $variantes[$index]['id'] : null,
            ];
        }
    }
    return $liste;
}

$importes   = 0;
$ignores    = 0;
$photos     = 0;
$manquantes = 0;
$erreurs    = [];

foreach ($manifeste['produits'] as $ligne) {
    $nom  = $ligne['nom'];
    $slug = Slug::creer($nom);

    $existant = Database::unique('SELECT id FROM produits WHERE slug = ?', [$slug]);
    if ($existant !== null) {
        /* Un produit inscrit alors que ses photos n'étaient pas encore sur
           le disque reste sans visuel. On les lui rattache au passage
           suivant. Un produit qui a déjà des images n'est jamais touché :
           c'est ce qui garde le script rejouable sans créer de doublons. */
        $dejaVisuel = (int) Database::valeur(
            'SELECT COUNT(*) FROM images_produit WHERE produit_id = ?',
            [$existant['id']]
        );
        if ($dejaVisuel > 0) {
            echo "= $nom (déjà présent)\n";
            $ignores++;
            continue;
        }

        $variantes = Database::toutes(
            'SELECT id FROM variantes WHERE produit_id = ? ORDER BY id',
            [$existant['id']]
        );
        $rattachees = 0;
        foreach (photosDuProduit($ligne, $variantes) as $element) {
            $source = "$dossierPhotos/{$element['fichier']}";
            if (!is_file($source)) {
                $manquantes++;
                continue;
            }
            ImageProduit::creer(
                (int) $existant['id'],
                ImageService::importer($source),
                $element['variante_id'],
                null
            );
            $photos++;
            $rattachees++;
        }
        if ($rattachees > 0) {
            echo "~ $nom — $rattachees photo(s) rattachée(s)\n";
        } else {
            echo "= $nom (déjà présent, toujours sans photo)\n";
            $ignores++;
        }
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

        $aPlacer = photosDuProduit($ligne, $produit['variantes']);

        foreach ($aPlacer as $element) {
            $source = "$dossierPhotos/{$element['fichier']}";
            // Une photo encore absente ne doit pas faire échouer la fiche :
            // on inscrit le produit, la photo se rattache plus tard.
            if (!is_file($source)) {
                echo "  ? photo absente, ignorée : {$element['fichier']}\n";
                $manquantes++;
                continue;
            }
            $chemin = ImageService::importer($source);
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
if ($manquantes > 0) {
    echo "Photos absentes   : $manquantes — déposez les fichiers puis relancez pour les rattacher.\n";
}
if ($erreurs !== []) {
    echo "Erreurs :\n  - " . implode("\n  - ", $erreurs) . "\n";
}
echo "\nLes produits sont en brouillon, au prix 0. Ouvrez le back-office,\n";
echo "saisissez les prix et les quantités, puis cochez « Visible dans la boutique ».\n";
