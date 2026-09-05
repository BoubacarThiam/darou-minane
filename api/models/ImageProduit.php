<?php
declare(strict_types=1);

final class ImageProduit
{
    public static function parId(int $id): ?array
    {
        return Database::unique('SELECT * FROM images_produit WHERE id = ?', [$id]);
    }

    public static function pourProduit(int $produitId): array
    {
        return Database::toutes(
            'SELECT * FROM images_produit WHERE produit_id = ? ORDER BY position, id',
            [$produitId]
        );
    }

    /**
     * Images de plusieurs produits en une requête (listes de catalogue).
     * @return array<int, array<int, array<string, mixed>>> indexé par produit_id
     */
    public static function pourProduits(array $produitIds): array
    {
        if ($produitIds === []) {
            return [];
        }
        $marqueurs = implode(',', array_fill(0, count($produitIds), '?'));
        $lignes = Database::toutes(
            "SELECT * FROM images_produit WHERE produit_id IN ($marqueurs) ORDER BY position, id",
            array_map('intval', $produitIds)
        );

        $parProduit = [];
        foreach ($lignes as $ligne) {
            $parProduit[(int) $ligne['produit_id']][] = $ligne;
        }
        return $parProduit;
    }

    public static function creer(int $produitId, string $chemin, ?int $varianteId, ?int $position): array
    {
        Database::requete(
            'INSERT INTO images_produit (produit_id, variante_id, chemin, position) VALUES (?, ?, ?, ?)',
            [$produitId, $varianteId, $chemin, $position ?? self::prochainePosition($produitId)]
        );
        $id = (int) Database::pdo()->lastInsertId();
        return self::presenter(self::parId($id) ?? throw new RuntimeException('Image non enregistrée.'));
    }

    public static function modifier(int $id, array $champs): array
    {
        $image = self::parId($id) ?? throw HttpException::introuvable('Image introuvable.');

        $colonnes = [];
        $valeurs  = [];
        if (array_key_exists('position', $champs)) {
            $colonnes[] = 'position = ?';
            $valeurs[]  = (int) $champs['position'];
        }
        if (array_key_exists('variante_id', $champs)) {
            $varianteId = $champs['variante_id'];
            if ($varianteId !== null) {
                $variante = Variante::parId((int) $varianteId);
                if ($variante === null || (int) $variante['produit_id'] !== (int) $image['produit_id']) {
                    throw HttpException::validation(['variante_id' => 'Cette variante n\'appartient pas au produit.']);
                }
                $varianteId = (int) $varianteId;
            }
            $colonnes[] = 'variante_id = ?';
            $valeurs[]  = $varianteId;
        }
        if ($colonnes !== []) {
            $valeurs[] = $id;
            Database::requete('UPDATE images_produit SET ' . implode(', ', $colonnes) . ' WHERE id = ?', $valeurs);
        }
        return self::presenter(self::parId($id) ?? throw new RuntimeException('Image introuvable.'));
    }

    public static function supprimer(int $id): void
    {
        $image = self::parId($id) ?? throw HttpException::introuvable('Image introuvable.');
        Database::requete('DELETE FROM images_produit WHERE id = ?', [$id]);
        // Le fichier n'est effacé que s'il n'est plus référencé nulle part.
        $reste = (int) Database::valeur('SELECT COUNT(*) FROM images_produit WHERE chemin = ?', [$image['chemin']]);
        if ($reste === 0) {
            ImageService::supprimer($image['chemin']);
        }
    }

    private static function prochainePosition(int $produitId): int
    {
        return 1 + (int) Database::valeur(
            'SELECT COALESCE(MAX(position), 0) FROM images_produit WHERE produit_id = ?',
            [$produitId]
        );
    }

    public static function presenter(array $ligne): array
    {
        return [
            'id'          => (int) $ligne['id'],
            'url'         => ImageService::urlPublique($ligne['chemin']),
            'chemin'      => $ligne['chemin'],
            'variante_id' => $ligne['variante_id'] !== null ? (int) $ligne['variante_id'] : null,
            'position'    => (int) $ligne['position'],
        ];
    }
}
