<?php
declare(strict_types=1);

final class Request
{
    private array $corps;

    public function __construct(
        private string $methode,
        private string $chemin,
        private array $query,
        private array $entetes,
        string $corpsBrut
    ) {
        $this->corps = self::decoderCorps($corpsBrut, $this->entete('Content-Type') ?? '');
    }

    public static function depuisGlobals(string $basePath): self
    {
        $chemin = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        if ($basePath !== '' && str_starts_with($chemin, $basePath)) {
            $chemin = substr($chemin, strlen($basePath));
        }
        $chemin = '/' . trim(rawurldecode($chemin), '/');

        $entetes = [];
        foreach ($_SERVER as $cle => $valeur) {
            if (str_starts_with($cle, 'HTTP_')) {
                $entetes[strtolower(str_replace('_', '-', substr($cle, 5)))] = $valeur;
            }
        }
        if (isset($_SERVER['CONTENT_TYPE']))   { $entetes['content-type'] = $_SERVER['CONTENT_TYPE']; }
        if (isset($_SERVER['CONTENT_LENGTH'])) { $entetes['content-length'] = $_SERVER['CONTENT_LENGTH']; }

        return new self(
            strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'),
            $chemin,
            $_GET,
            $entetes,
            file_get_contents('php://input') ?: ''
        );
    }

    private static function decoderCorps(string $brut, string $typeContenu): array
    {
        if (str_contains($typeContenu, 'application/json') && $brut !== '') {
            $donnees = json_decode($brut, true);
            if (!is_array($donnees)) {
                throw new HttpException('Corps de requête JSON invalide.', 400);
            }
            return $donnees;
        }
        // multipart/form-data et x-www-form-urlencoded : PHP a déjà rempli $_POST
        return $_POST;
    }

    public function methode(): string { return $this->methode; }
    public function chemin(): string  { return $this->chemin; }
    public function corps(): array    { return $this->corps; }

    public function entete(string $nom): ?string
    {
        return $this->entetes[strtolower($nom)] ?? null;
    }

    public function query(string $cle, mixed $defaut = null): mixed
    {
        $valeur = $this->query[$cle] ?? null;
        return ($valeur === null || $valeur === '') ? $defaut : $valeur;
    }

    public function ip(): string
    {
        return (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    }

    public function estEcriture(): bool
    {
        return !in_array($this->methode, ['GET', 'HEAD', 'OPTIONS'], true);
    }
}
