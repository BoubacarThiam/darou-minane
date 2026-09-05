<?php
declare(strict_types=1);

/**
 * Erreur destinée au client : le routeur la transforme en réponse JSON.
 * $champs porte le détail des erreurs de validation, champ par champ.
 */
class HttpException extends RuntimeException
{
    public function __construct(
        string $message,
        private int $statut = 400,
        private array $champs = []
    ) {
        parent::__construct($message);
    }

    public function statut(): int { return $this->statut; }
    public function champs(): array { return $this->champs; }

    public static function nonAutorise(string $m = 'Connexion requise.'): self { return new self($m, 401); }
    public static function interdit(string $m = 'Accès refusé.'): self { return new self($m, 403); }
    public static function introuvable(string $m = 'Ressource introuvable.'): self { return new self($m, 404); }
    public static function conflit(string $m): self { return new self($m, 409); }
    public static function validation(array $champs, string $m = 'Données invalides.'): self
    {
        return new self($m, 422, $champs);
    }
}
