<?php
declare(strict_types=1);

/**
 * Validation des entrées côté serveur. On n'écrit jamais en base une valeur
 * qui n'est pas passée par ici : chaque accesseur renvoie une valeur typée
 * et propre, et valider() lève une 422 récapitulant tous les champs fautifs.
 */
final class Validator
{
    private array $erreurs = [];

    public function __construct(private array $donnees) {}

    public function present(string $champ): bool
    {
        return array_key_exists($champ, $this->donnees);
    }

    private function brut(string $champ): mixed
    {
        return $this->donnees[$champ] ?? null;
    }

    private function erreur(string $champ, string $message): void
    {
        $this->erreurs[$champ] = $message;
    }

    public function chaine(string $champ, bool $requis = false, int $min = 0, int $max = 255, ?string $defaut = null): ?string
    {
        $valeur = $this->brut($champ);
        if ($valeur === null || (is_string($valeur) && trim($valeur) === '')) {
            if ($requis) { $this->erreur($champ, 'Ce champ est obligatoire.'); }
            return $defaut;
        }
        if (!is_string($valeur)) {
            $this->erreur($champ, 'Texte attendu.');
            return $defaut;
        }
        $valeur = trim(preg_replace('/\s+/u', ' ', $valeur) ?? $valeur);
        $taille = mb_strlen($valeur);
        if ($taille < $min) { $this->erreur($champ, "Au moins $min caractères."); return $defaut; }
        if ($taille > $max) { $this->erreur($champ, "Au plus $max caractères."); return $defaut; }
        return $valeur;
    }

    /** Texte libre multiligne (description, note client) : les retours à la ligne sont conservés. */
    public function texte(string $champ, bool $requis = false, int $max = 5000, ?string $defaut = null): ?string
    {
        $valeur = $this->brut($champ);
        if ($valeur === null || (is_string($valeur) && trim($valeur) === '')) {
            if ($requis) { $this->erreur($champ, 'Ce champ est obligatoire.'); }
            return $defaut;
        }
        if (!is_string($valeur)) { $this->erreur($champ, 'Texte attendu.'); return $defaut; }
        $valeur = trim($valeur);
        if (mb_strlen($valeur) > $max) { $this->erreur($champ, "Au plus $max caractères."); return $defaut; }
        return $valeur;
    }

    /** Mot de passe : ni trim ni normalisation, la valeur est prise telle quelle. */
    public function secret(string $champ, bool $requis = false, int $min = 6, int $max = 200): ?string
    {
        $valeur = $this->brut($champ);
        if ($valeur === null || $valeur === '') {
            if ($requis) { $this->erreur($champ, 'Ce champ est obligatoire.'); }
            return null;
        }
        if (!is_string($valeur)) { $this->erreur($champ, 'Texte attendu.'); return null; }
        $taille = mb_strlen($valeur);
        if ($taille < $min) { $this->erreur($champ, "Au moins $min caractères."); return null; }
        if ($taille > $max) { $this->erreur($champ, "Au plus $max caractères."); return null; }
        return $valeur;
    }

    public function entier(string $champ, bool $requis = false, ?int $min = null, ?int $max = null, ?int $defaut = null): ?int
    {
        $valeur = $this->brut($champ);
        if ($valeur === null || $valeur === '') {
            if ($requis) { $this->erreur($champ, 'Ce champ est obligatoire.'); }
            return $defaut;
        }
        if (is_bool($valeur) || !is_numeric($valeur) || (int) $valeur != $valeur) {
            $this->erreur($champ, 'Nombre entier attendu.');
            return $defaut;
        }
        $entier = (int) $valeur;
        if ($min !== null && $entier < $min) { $this->erreur($champ, "Minimum : $min."); return $defaut; }
        if ($max !== null && $entier > $max) { $this->erreur($champ, "Maximum : $max."); return $defaut; }
        return $entier;
    }

    public function booleen(string $champ, ?bool $defaut = null): ?bool
    {
        $valeur = $this->brut($champ);
        if ($valeur === null || $valeur === '') { return $defaut; }
        $converti = filter_var($valeur, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($converti === null) { $this->erreur($champ, 'Valeur oui/non attendue.'); return $defaut; }
        return $converti;
    }

    public function parmi(string $champ, array $valeurs, bool $requis = false, ?string $defaut = null): ?string
    {
        $valeur = $this->brut($champ);
        if ($valeur === null || $valeur === '') {
            if ($requis) { $this->erreur($champ, 'Ce champ est obligatoire.'); }
            return $defaut;
        }
        if (!in_array($valeur, $valeurs, true)) {
            $this->erreur($champ, 'Valeur attendue : ' . implode(', ', $valeurs) . '.');
            return $defaut;
        }
        return (string) $valeur;
    }

    /**
     * Normalise un numéro sénégalais au format international sans « + » :
     * « 77 338 55 35 », « +221 77 338 55 35 » et « 221773385535 » donnent
     * tous « 221773385535 ».
     */
    public function telephone(string $champ, bool $requis = false, ?string $defaut = null): ?string
    {
        $valeur = $this->brut($champ);
        if ($valeur === null || (is_string($valeur) && trim($valeur) === '')) {
            if ($requis) { $this->erreur($champ, 'Ce champ est obligatoire.'); }
            return $defaut;
        }
        $chiffres = preg_replace('/\D+/', '', (string) $valeur) ?? '';
        if (str_starts_with($chiffres, '00')) { $chiffres = substr($chiffres, 2); }
        if (strlen($chiffres) === 9 && $chiffres[0] === '7') { $chiffres = '221' . $chiffres; }
        if (!preg_match('/^\d{9,15}$/', $chiffres)) {
            $this->erreur($champ, 'Numéro de téléphone invalide.');
            return $defaut;
        }
        return $chiffres;
    }

    public function email(string $champ, bool $requis = false): ?string
    {
        $valeur = $this->chaine($champ, $requis, 0, 160);
        if ($valeur === null) {
            return null;
        }
        if (filter_var($valeur, FILTER_VALIDATE_EMAIL) === false) {
            $this->erreur($champ, 'Adresse e-mail invalide.');
            return null;
        }
        return mb_strtolower($valeur);
    }

    /** @return array<int, array<string, mixed>>|null */
    public function tableau(string $champ, bool $requis = false, int $min = 0, int $max = 200): ?array
    {
        $valeur = $this->brut($champ);
        if ($valeur === null || $valeur === '') {
            if ($requis) { $this->erreur($champ, 'Ce champ est obligatoire.'); }
            return null;
        }
        if (!is_array($valeur)) { $this->erreur($champ, 'Liste attendue.'); return null; }
        if (count($valeur) < $min) { $this->erreur($champ, "Au moins $min élément(s)."); return null; }
        if (count($valeur) > $max) { $this->erreur($champ, "Au plus $max élément(s)."); return null; }
        return $valeur;
    }

    public function ajouterErreur(string $champ, string $message): void
    {
        $this->erreur($champ, $message);
    }

    public function valider(): void
    {
        if ($this->erreurs !== []) {
            throw HttpException::validation($this->erreurs);
        }
    }
}
