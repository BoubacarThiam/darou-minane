<?php
declare(strict_types=1);

final class Router
{
    /** @var array<string, array<array{motif: string, action: callable}>> */
    private array $routes = [];

    public function get(string $motif, callable $action): void    { $this->ajouter('GET', $motif, $action); }
    public function post(string $motif, callable $action): void   { $this->ajouter('POST', $motif, $action); }
    public function put(string $motif, callable $action): void    { $this->ajouter('PUT', $motif, $action); }
    public function patch(string $motif, callable $action): void  { $this->ajouter('PATCH', $motif, $action); }
    public function delete(string $motif, callable $action): void { $this->ajouter('DELETE', $motif, $action); }

    private function ajouter(string $methode, string $motif, callable $action): void
    {
        $this->routes[$methode][] = ['motif' => $motif, 'action' => $action];
    }

    /**
     * « /produits/{slug} » devient « #^/produits/(?P<slug>[^/]+)$# ».
     * Les segments littéraux sont échappés, les paramètres ne capturent
     * jamais un « / » : une route ne peut pas déborder sur la suivante.
     */
    private static function regex(string $motif): string
    {
        static $cache = [];
        if (isset($cache[$motif])) {
            return $cache[$motif];
        }

        $regex = '';
        foreach (preg_split('#(\{[a-z_]+\})#', $motif, -1, PREG_SPLIT_DELIM_CAPTURE) ?: [] as $partie) {
            if (preg_match('#^\{([a-z_]+)\}$#', $partie, $nom)) {
                $regex .= '(?P<' . $nom[1] . '>[^/]+)';
            } else {
                $regex .= preg_quote($partie, '#');
            }
        }

        return $cache[$motif] = '#^' . $regex . '$#u';
    }

    public function dispatch(Request $requete): void
    {
        $chemin           = $requete->chemin();
        $methodesPossibles = [];

        foreach ($this->routes as $methode => $routes) {
            foreach ($routes as $route) {
                if (preg_match(self::regex($route['motif']), $chemin, $correspondances)) {
                    if ($methode === $requete->methode()) {
                        $parametres = array_filter(
                            $correspondances,
                            static fn($cle): bool => !is_int($cle),
                            ARRAY_FILTER_USE_KEY
                        );
                        ($route['action'])($requete, $parametres);
                        return;
                    }
                    $methodesPossibles[] = $methode;
                }
            }
        }

        if ($methodesPossibles !== []) {
            header('Allow: ' . implode(', ', array_unique($methodesPossibles)));
            throw new HttpException('Méthode non autorisée sur cette route.', 405);
        }
        throw HttpException::introuvable('Route inconnue : ' . $chemin);
    }
}
