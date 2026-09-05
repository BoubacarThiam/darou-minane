<?php
declare(strict_types=1);

/**
 * Point d'entrée unique de l'API Darou Minane.
 * Toutes les requêtes /api/... arrivent ici (voir .htaccess).
 */

// Serveur de développement PHP : laisser servir les fichiers réels (images).
if (PHP_SAPI === 'cli-server') {
    $fichier = __DIR__ . (parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
    if (is_file($fichier) && !str_ends_with($fichier, '.php')) {
        return false;
    }
}

require __DIR__ . '/lib/Config.php';
Config::charger(__DIR__ . '/config.php');

spl_autoload_register(static function (string $classe): void {
    foreach (['lib', 'models', 'controllers'] as $dossier) {
        $fichier = __DIR__ . '/' . $dossier . '/' . $classe . '.php';
        if (is_file($fichier)) {
            require $fichier;
            return;
        }
    }
});

error_reporting(E_ALL);
ini_set('display_errors', '0');           // les erreurs sortent en JSON, jamais en HTML
ini_set('log_errors', '1');
date_default_timezone_set('UTC');          // le Sénégal est à UTC+0

// --- CORS : utile en développement (Vite sur un autre port) ---------------
$origine = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origine !== '' && in_array($origine, (array) Config::get('app.origines_autorisees', []), true)) {
    header('Access-Control-Allow-Origin: ' . $origine);
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token, X-Requested-With');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Max-Age: 86400');
}
header('Vary: Origin');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// --- Préfixe de l'API dans l'URL -----------------------------------------
$basePath = Config::get('app.base_path');
if ($basePath === null) {
    $basePath = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
    if ($basePath === '/' || $basePath === '.') {
        $basePath = '';
    }
}

try {
    $requete = Request::depuisGlobals((string) $basePath);
    Auth::demarrerSession();

    $routeur = new Router();

    // ---- Boutique publique (aucun compte requis) ------------------------
    $routeur->get('/',                  [CatalogueController::class, 'boutique']);
    $routeur->get('/boutique',          [CatalogueController::class, 'boutique']);
    $routeur->get('/categories',        [CatalogueController::class, 'categories']);
    $routeur->get('/produits',          [CatalogueController::class, 'produits']);
    $routeur->get('/produits/{slug}',   [CatalogueController::class, 'produit']);

    // ---- Authentification ------------------------------------------------
    $routeur->post('/auth/connexion',    [AuthController::class, 'connexion']);
    $routeur->post('/auth/deconnexion',  [AuthController::class, 'deconnexion']);
    $routeur->get('/auth/moi',           [AuthController::class, 'moi']);
    $routeur->put('/auth/mot-de-passe',  [AuthController::class, 'changerMotDePasse']);

    // ---- Catalogue back-office ------------------------------------------
    $routeur->get('/admin/produits',                   [ProduitController::class, 'index']);
    $routeur->post('/admin/produits',                  [ProduitController::class, 'store']);
    $routeur->get('/admin/produits/{id}',              [ProduitController::class, 'show']);
    $routeur->put('/admin/produits/{id}',              [ProduitController::class, 'update']);
    $routeur->delete('/admin/produits/{id}',           [ProduitController::class, 'destroy']);
    $routeur->post('/admin/produits/{id}/variantes',   [ProduitController::class, 'ajouterVariante']);
    $routeur->post('/admin/produits/{id}/images',      [ImageController::class, 'store']);

    $routeur->get('/admin/variantes',         [VarianteController::class, 'index']);
    $routeur->put('/admin/variantes/{id}',    [VarianteController::class, 'update']);
    $routeur->delete('/admin/variantes/{id}', [VarianteController::class, 'destroy']);

    $routeur->put('/admin/images/{id}',    [ImageController::class, 'update']);
    $routeur->delete('/admin/images/{id}', [ImageController::class, 'destroy']);

    $routeur->post('/admin/categories',        [CategorieController::class, 'store']);
    $routeur->put('/admin/categories/{id}',    [CategorieController::class, 'update']);
    $routeur->delete('/admin/categories/{id}', [CategorieController::class, 'destroy']);

    // ---- Ventes au comptoir -----------------------------------------------
    $routeur->post('/admin/commandes',      [CommandeController::class, 'venteComptoir']);
    $routeur->get('/admin/commandes/{id}',  [CommandeController::class, 'show']);

    // ---- Stock ------------------------------------------------------------
    $routeur->get('/admin/stock/mouvements',  [StockController::class, 'mouvements']);
    $routeur->post('/admin/stock/mouvements', [StockController::class, 'creerMouvement']);
    $routeur->get('/admin/stock/alertes',     [StockController::class, 'alertes']);

    // ---- Comptes (propriétaire) ------------------------------------------
    $routeur->get('/admin/utilisateurs',        [UtilisateurController::class, 'index']);
    $routeur->post('/admin/utilisateurs',       [UtilisateurController::class, 'store']);
    $routeur->put('/admin/utilisateurs/{id}',   [UtilisateurController::class, 'update']);
    $routeur->delete('/admin/utilisateurs/{id}',[UtilisateurController::class, 'destroy']);

    $routeur->dispatch($requete);
} catch (HttpException $e) {
    Response::erreur($e->getMessage(), $e->statut(), $e->champs());
} catch (PDOException $e) {
    error_log('[darou-minane] SQL : ' . $e->getMessage());
    Response::erreur(
        Config::estDeveloppement() ? 'SQL : ' . $e->getMessage() : 'Erreur de base de données.',
        500
    );
} catch (Throwable $e) {
    error_log(sprintf('[darou-minane] %s : %s (%s:%d)', $e::class, $e->getMessage(), $e->getFile(), $e->getLine()));
    Response::erreur(
        Config::estDeveloppement()
            ? $e->getMessage() . ' — ' . $e->getFile() . ':' . $e->getLine()
            : 'Une erreur est survenue. Réessayez.',
        500
    );
}
