<?php
declare(strict_types=1);

final class Categorie
{
    public static function toutes(bool $avecCompteurs = false): array
    {
        $sql = $avecCompteurs
            ? 'SELECT c.id, c.nom, c.slug, c.ordre,
                      (SELECT COUNT(*) FROM produits p WHERE p.categorie_id = c.id AND p.actif = 1) AS nb_produits
                 FROM categories c ORDER BY c.ordre, c.nom'
            : 'SELECT id, nom, slug, ordre FROM categories ORDER BY ordre, nom';

        return array_map(static fn(array $l): array => [
            'id'    => (int) $l['id'],
            'nom'   => $l['nom'],
            'slug'  => $l['slug'],
            'ordre' => (int) $l['ordre'],
        ] + (isset($l['nb_produits']) ? ['nb_produits' => (int) $l['nb_produits']] : []), Database::toutes($sql));
    }

    public static function parId(int $id): ?array
    {
        return Database::unique('SELECT * FROM categories WHERE id = ?', [$id]);
    }

    public static function parSlug(string $slug): ?array
    {
        return Database::unique('SELECT * FROM categories WHERE slug = ?', [$slug]);
    }

    public static function creer(string $nom, ?int $ordre): array
    {
        Database::requete(
            'INSERT INTO categories (nom, slug, ordre) VALUES (?, ?, ?)',
            [$nom, Slug::unique($nom, 'categories'), $ordre ?? 0]
        );
        $id = (int) Database::pdo()->lastInsertId();
        return self::presenter(self::parId($id) ?? throw new RuntimeException('Catégorie non créée.'));
    }

    public static function modifier(int $id, array $champs): array
    {
        self::parId($id) ?? throw HttpException::introuvable('Catégorie introuvable.');

        $colonnes = [];
        $valeurs  = [];
        if (array_key_exists('nom', $champs)) {
            $colonnes[] = 'nom = ?';  $valeurs[] = $champs['nom'];
            $colonnes[] = 'slug = ?'; $valeurs[] = Slug::unique($champs['nom'], 'categories', $id);
        }
        if (array_key_exists('ordre', $champs)) {
            $colonnes[] = 'ordre = ?'; $valeurs[] = (int) $champs['ordre'];
        }
        if ($colonnes !== []) {
            $valeurs[] = $id;
            Database::requete('UPDATE categories SET ' . implode(', ', $colonnes) . ' WHERE id = ?', $valeurs);
        }
        return self::presenter(self::parId($id) ?? throw new RuntimeException('Catégorie introuvable.'));
    }

    public static function supprimer(int $id): void
    {
        self::parId($id) ?? throw HttpException::introuvable('Catégorie introuvable.');
        $nbProduits = (int) Database::valeur('SELECT COUNT(*) FROM produits WHERE categorie_id = ?', [$id]);
        if ($nbProduits > 0) {
            throw HttpException::conflit(
                "Cette catégorie contient $nbProduits produit(s) : déplacez-les avant de la supprimer."
            );
        }
        Database::requete('DELETE FROM categories WHERE id = ?', [$id]);
    }

    public static function presenter(array $ligne): array
    {
        return [
            'id'    => (int) $ligne['id'],
            'nom'   => $ligne['nom'],
            'slug'  => $ligne['slug'],
            'ordre' => (int) $ligne['ordre'],
        ];
    }
}
