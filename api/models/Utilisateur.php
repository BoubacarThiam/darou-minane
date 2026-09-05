<?php
declare(strict_types=1);

final class Utilisateur
{
    public static function parTelephone(string $telephone): ?array
    {
        return Database::unique('SELECT * FROM utilisateurs WHERE telephone = ? LIMIT 1', [$telephone]);
    }

    public static function parId(int $id): ?array
    {
        return Database::unique('SELECT * FROM utilisateurs WHERE id = ? LIMIT 1', [$id]);
    }

    /** @return array<int, array<string, mixed>> sans les empreintes de mots de passe */
    public static function liste(): array
    {
        $lignes = Database::toutes(
            'SELECT id, nom, telephone, role, actif, dernier_login, created_at
               FROM utilisateurs ORDER BY actif DESC, nom'
        );
        return array_map(self::presenter(...), $lignes);
    }

    public static function creer(string $nom, string $telephone, string $motDePasse, string $role): array
    {
        if (self::parTelephone($telephone) !== null) {
            throw HttpException::validation(['telephone' => 'Ce numéro est déjà utilisé par un compte.']);
        }
        Database::requete(
            'INSERT INTO utilisateurs (nom, telephone, mot_de_passe_hash, role, actif)
             VALUES (?, ?, ?, ?, 1)',
            [$nom, $telephone, password_hash($motDePasse, PASSWORD_DEFAULT), $role]
        );
        $id = (int) Database::pdo()->lastInsertId();
        return self::presenter(self::parId($id) ?? throw new RuntimeException('Compte non créé.'));
    }

    public static function modifier(int $id, array $champs): array
    {
        $utilisateur = self::parId($id) ?? throw HttpException::introuvable('Compte introuvable.');

        if (isset($champs['telephone']) && $champs['telephone'] !== $utilisateur['telephone']) {
            $autre = self::parTelephone($champs['telephone']);
            if ($autre !== null) {
                throw HttpException::validation(['telephone' => 'Ce numéro est déjà utilisé par un compte.']);
            }
        }

        $colonnes = [];
        $valeurs  = [];
        foreach (['nom', 'telephone', 'role', 'actif'] as $colonne) {
            if (array_key_exists($colonne, $champs)) {
                $colonnes[] = "$colonne = ?";
                $valeurs[]  = $colonne === 'actif' ? (int) $champs[$colonne] : $champs[$colonne];
            }
        }
        if (array_key_exists('mot_de_passe', $champs)) {
            $colonnes[] = 'mot_de_passe_hash = ?';
            $valeurs[]  = password_hash($champs['mot_de_passe'], PASSWORD_DEFAULT);
        }
        if ($colonnes !== []) {
            $valeurs[] = $id;
            Database::requete('UPDATE utilisateurs SET ' . implode(', ', $colonnes) . ' WHERE id = ?', $valeurs);
        }
        return self::presenter(self::parId($id) ?? throw new RuntimeException('Compte introuvable.'));
    }

    public static function changerMotDePasse(int $id, string $motDePasse): void
    {
        Database::requete(
            'UPDATE utilisateurs SET mot_de_passe_hash = ? WHERE id = ?',
            [password_hash($motDePasse, PASSWORD_DEFAULT), $id]
        );
    }

    public static function marquerConnexion(int $id): void
    {
        Database::requete('UPDATE utilisateurs SET dernier_login = NOW() WHERE id = ?', [$id]);
    }

    /** Combien de propriétaires actifs restent-ils ? (on interdit de supprimer le dernier) */
    public static function nombreProprietairesActifs(): int
    {
        return (int) Database::valeur(
            "SELECT COUNT(*) FROM utilisateurs WHERE role = 'proprietaire' AND actif = 1"
        );
    }

    public static function presenter(array $ligne): array
    {
        return [
            'id'            => (int) $ligne['id'],
            'nom'           => $ligne['nom'],
            'telephone'     => $ligne['telephone'],
            'role'          => $ligne['role'],
            'actif'         => (bool) $ligne['actif'],
            'dernier_login' => $ligne['dernier_login'] ?? null,
            'created_at'    => $ligne['created_at'] ?? null,
        ];
    }
}
