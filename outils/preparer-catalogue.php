<?php
declare(strict_types=1);

/**
 * Met le catalogue importé en vitrine.
 *
 *   php outils/preparer-catalogue.php
 *
 * Trois choses, dans cet ordre :
 *   1. supprime le jeu de démonstration s'il est encore là (les commandes
 *      survivent : lignes_commande fige libellé et prix, variante_id passe
 *      à NULL) ;
 *   2. pose des prix PROVISOIRES et un stock de départ sur les produits
 *      encore en brouillon, via de vrais mouvements « entree » — jamais un
 *      UPDATE de quantite tout seul, c'est la règle centrale du projet ;
 *   3. publie ces produits et met en avant un échantillon représentatif.
 *
 * Les prix sont des ordres de grandeur, à corriger par le propriétaire
 * dans le back-office. Le script ne touche jamais un produit déjà publié :
 * il est donc rejouable sans écraser un prix saisi à la main.
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

$pdo = Database::pdo();

/* ------------------------------------------------ 1. jeu de démonstration */

$idsDemo = array_map(
    static fn(array $l): int => (int) $l['id'],
    Database::toutes(
        "SELECT DISTINCT p.id FROM produits p
           JOIN images_produit i ON i.produit_id = p.id
          WHERE i.chemin LIKE 'demo/%'"
    )
);

if ($idsDemo !== []) {
    $trous = implode(',', array_fill(0, count($idsDemo), '?'));
    $pdo->beginTransaction();
    // Les mouvements bloquent la suppression (ON DELETE RESTRICT).
    $pdo->prepare(
        "DELETE m FROM mouvements_stock m
           JOIN variantes v ON v.id = m.variante_id
          WHERE v.produit_id IN ($trous)"
    )->execute($idsDemo);
    $pdo->prepare("DELETE FROM produits WHERE id IN ($trous)")->execute($idsDemo);
    $pdo->commit();
    echo 'Produits de démonstration supprimés : ' . count($idsDemo) . "\n";
}

/* ------------------------------------------------- 2. prix PROVISOIRES */

/** Prix provisoire d'un produit, en FCFA. À revoir par le propriétaire. */
function prixProvisoire(string $nom, string $categorie): int
{
    $n = mb_strtolower($nom);

    if ($categorie === 'Lunettes') {
        return str_contains($n, 'monture de vue') ? 7000 : 8000;
    }

    if ($categorie === 'Montres') {
        if (str_contains($n, 'automatique squelette')) return 45000;
        if (str_contains($n, 'poedagar'))              return 28000;
        if (str_contains($n, 'salcir'))                return 20000;
        return 18000;
    }

    if (str_starts_with($categorie, 'Diffuseurs')) {
        if (str_contains($n, 'goutte'))          return 15000;
        if (str_contains($n, 'humidificateur'))  return 6500;
        return 12000;
    }

    // Parfums : trois paliers selon la gamme.
    if (str_contains($n, 'jean miss')) return 9000;
    if (str_contains($n, 'sultan'))    return 12000;
    foreach (['musamam', 'collector', 'qaed al fursan', 'rayhaan', 'eternal oud'] as $haut) {
        if (str_contains($n, $haut)) return 30000;
    }
    return 22000;
}

/** Stock de départ, par catégorie. */
function stockDepart(string $categorie): int
{
    return match (true) {
        $categorie === 'Montres'                  => 3,
        $categorie === 'Lunettes'                 => 6,
        str_starts_with($categorie, 'Diffuseurs') => 4,
        default                                   => 5,
    };
}

$produits = Database::toutes(
    "SELECT p.id, p.nom, c.nom AS categorie
       FROM produits p JOIN categories c ON c.id = p.categorie_id
      WHERE p.actif = 0
      ORDER BY p.id"
);

$nbProduits = 0;
$nbVariantes = 0;
$valeur = 0;

foreach ($produits as $produit) {
    $prix  = prixProvisoire($produit['nom'], $produit['categorie']);
    $stock = stockDepart($produit['categorie']);
    $variantes = Database::toutes('SELECT id, quantite FROM variantes WHERE produit_id = ?', [$produit['id']]);

    $pdo->beginTransaction();
    try {
        foreach ($variantes as $variante) {
            $pdo->prepare('UPDATE variantes SET prix = ?, seuil_alerte = 2 WHERE id = ?')
                ->execute([$prix, $variante['id']]);

            $manque = $stock - (int) $variante['quantite'];
            if ($manque > 0) {
                Stock::appliquer($pdo, (int) $variante['id'], 'entree', $manque,
                    'Stock de départ — inventaire à confirmer', null, null);
            }
            $nbVariantes++;
            $valeur += $prix * $stock;
        }
        $pdo->prepare('UPDATE produits SET actif = 1 WHERE id = ?')->execute([$produit['id']]);
        $pdo->commit();
        $nbProduits++;
    } catch (Throwable $e) {
        $pdo->rollBack();
        echo "! {$produit['nom']} — " . $e->getMessage() . "\n";
    }
}

/* ------------------------------------------------ 3. sélection de vitrine */

/* « Derniers arrivages » trie par nouveauté : sans sélection, l'accueil ne
   montrerait que la dernière catégorie importée. Un échantillon des trois
   rayons la rend représentative. Le propriétaire la change quand il veut. */
$vitrine = [
    'Lattafa Teriaq Intense',
    'Paris Corner Taskeen Marina',
    'Lattafa Musamam, coffret marron',
    'Asdaaf Ameerat Al Arab',
    'Khadlaj Oud Noir',
    'Afnan 9 PM',
    'Montre POEDAGAR, cadran vert',
    'Lunettes de soleil sans monture',
    'Diffuseur vase bois',
];
$trous = implode(',', array_fill(0, count($vitrine), '?'));
Database::requete('UPDATE produits SET mis_en_avant = 0');
Database::requete("UPDATE produits SET mis_en_avant = 1 WHERE nom IN ($trous)", $vitrine);

echo "Produits publiés  : $nbProduits\n";
echo "Variantes servies : $nbVariantes\n";
echo 'Valeur du stock   : ' . number_format($valeur, 0, ',', ' ') . " FCFA\n";
echo "\nLes prix sont PROVISOIRES : le propriétaire les corrige dans le back-office.\n";
