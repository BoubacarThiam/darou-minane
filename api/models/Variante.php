<?php
declare(strict_types=1);

final class Variante
{
    public static function parId(int $id): ?array
    {
        return Database::unique(
            'SELECT v.*, p.nom AS produit_nom, p.slug AS produit_slug, p.actif AS produit_actif
               FROM variantes v JOIN produits p ON p.id = v.produit_id
              WHERE v.id = ?',
            [$id]
        );
    }

    public static function parProduit(int $produitId, bool $actifSeulement): array
    {
        return Database::toutes(
            'SELECT * FROM variantes WHERE produit_id = ?' . ($actifSeulement ? ' AND actif = 1' : '')
            . ' ORDER BY position, id',
            [$produitId]
        );
    }

    /**
     * Recherche à la volée pour l'écran de vente rapide : on cherche des
     * VARIANTES (l'article réellement vendu et décrémenté), par nom de
     * produit, par SKU ou par libellé de déclinaison.
     */
    public static function rechercher(?string $recherche, int $limite, bool $disponibleSeulement): array
    {
        $conditions = ['v.actif = 1', 'p.actif = 1'];
        $params     = [];

        if ($recherche !== null && $recherche !== '') {
            $motif        = '%' . str_replace(['%', '_'], ['\\%', '\\_'], $recherche) . '%';
            $conditions[] = '(p.nom LIKE ? OR v.sku LIKE ? OR v.libelle LIKE ?)';
            $params[]     = $motif;
            $params[]     = $motif;
            $params[]     = $motif;
        }
        if ($disponibleSeulement) {
            $conditions[] = 'v.quantite > 0';
        }

        $lignes = Database::toutes(
            'SELECT v.*, p.nom AS produit_nom, p.slug AS produit_slug,
                    (SELECT i.chemin FROM images_produit i
                      WHERE i.produit_id = p.id AND (i.variante_id = v.id OR i.variante_id IS NULL)
                   ORDER BY (i.variante_id = v.id) DESC, i.position LIMIT 1) AS image
               FROM variantes v
               JOIN produits p ON p.id = v.produit_id
              WHERE ' . implode(' AND ', $conditions) . '
           ORDER BY p.nom, v.position
              LIMIT ' . (int) $limite,
            $params
        );

        return array_map(static fn(array $l): array => self::presenter($l, true) + [
            'produit_nom'  => $l['produit_nom'],
            'produit_slug' => $l['produit_slug'],
            'image'        => $l['image'] !== null ? ImageService::urlPublique($l['image']) : null,
        ], $lignes);
    }

    /**
     * Crée une variante. Si une quantité initiale est fournie, elle entre en
     * stock par un mouvement « entree » : jamais de stock sorti de nulle part.
     */
    public static function creer(int $produitId, array $donnees, ?int $utilisateurId): array
    {
        $id = Database::transaction(static function (PDO $pdo) use ($produitId, $donnees, $utilisateurId): int {
            $produit = Database::unique('SELECT id, nom FROM produits WHERE id = ?', [$produitId])
                ?? throw HttpException::introuvable('Produit introuvable.');

            $sku = $donnees['sku'] ?? null;
            $sku = ($sku === null || $sku === '')
                ? self::genererSku($produit['nom'], $donnees['libelle'])
                : self::verifierSkuLibre($sku);

            $pdo->prepare(
                'INSERT INTO variantes (produit_id, sku, libelle, prix, prix_achat, quantite, seuil_alerte, position, actif)
                 VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)'
            )->execute([
                $produitId,
                $sku,
                $donnees['libelle'],
                $donnees['prix'],
                $donnees['prix_achat'] ?? null,
                $donnees['seuil_alerte'] ?? 3,
                $donnees['position'] ?? self::prochainePosition($produitId),
                (int) ($donnees['actif'] ?? true),
            ]);
            $varianteId = (int) $pdo->lastInsertId();

            $quantite = (int) ($donnees['quantite'] ?? 0);
            if ($quantite > 0) {
                Stock::appliquer(
                    $pdo,
                    $varianteId,
                    'entree',
                    $quantite,
                    $donnees['motif_stock'] ?? 'Stock initial à la création de la variante',
                    null,
                    $utilisateurId
                );
            }
            return $varianteId;
        });

        return self::presenter(self::parId($id) ?? throw new RuntimeException('Variante non créée.'), true);
    }

    /**
     * Modifie les caractéristiques d'une variante. La quantité n'est jamais
     * modifiable ici : elle passe par le module Stock (mouvements).
     */
    public static function modifier(int $id, array $champs): array
    {
        $variante = self::parId($id) ?? throw HttpException::introuvable('Variante introuvable.');

        $colonnes = [];
        $valeurs  = [];
        foreach (['libelle', 'prix', 'prix_achat', 'seuil_alerte', 'position', 'actif'] as $colonne) {
            if (array_key_exists($colonne, $champs)) {
                $colonnes[] = "$colonne = ?";
                $valeurs[]  = $colonne === 'actif' ? (int) $champs[$colonne] : $champs[$colonne];
            }
        }
        if (array_key_exists('sku', $champs) && $champs['sku'] !== $variante['sku']) {
            $colonnes[] = 'sku = ?';
            $valeurs[]  = self::verifierSkuLibre($champs['sku'], $id);
        }
        if ($colonnes !== []) {
            $valeurs[] = $id;
            Database::requete('UPDATE variantes SET ' . implode(', ', $colonnes) . ' WHERE id = ?', $valeurs);
        }
        return self::presenter(self::parId($id) ?? throw new RuntimeException('Variante introuvable.'), true);
    }

    /**
     * Supprime réellement la variante si elle n'a aucun historique
     * (erreur de saisie), sinon la désactive : l'historique de vente et de
     * stock n'est jamais amputé.
     *
     * @return array{supprimee: bool, message: string}
     */
    public static function retirer(int $id): array
    {
        self::parId($id) ?? throw HttpException::introuvable('Variante introuvable.');

        $mouvements = (int) Database::valeur('SELECT COUNT(*) FROM mouvements_stock WHERE variante_id = ?', [$id]);
        $lignes     = (int) Database::valeur('SELECT COUNT(*) FROM lignes_commande WHERE variante_id = ?', [$id]);

        if ($mouvements === 0 && $lignes === 0) {
            Database::requete('DELETE FROM images_produit WHERE variante_id = ?', [$id]);
            Database::requete('DELETE FROM variantes WHERE id = ?', [$id]);
            return ['supprimee' => true, 'message' => 'Variante supprimée.'];
        }

        Database::requete('UPDATE variantes SET actif = 0 WHERE id = ?', [$id]);
        return [
            'supprimee' => false,
            'message'   => 'Variante désactivée : elle a un historique de stock ou de ventes, qui est conservé.',
        ];
    }

    private static function prochainePosition(int $produitId): int
    {
        return 1 + (int) Database::valeur('SELECT COALESCE(MAX(position), 0) FROM variantes WHERE produit_id = ?', [$produitId]);
    }

    private static function verifierSkuLibre(string $sku, ?int $ignorerId = null): string
    {
        $sku = strtoupper(trim($sku));
        $sql = 'SELECT id FROM variantes WHERE sku = ?' . ($ignorerId !== null ? ' AND id <> ?' : '');
        $params = $ignorerId !== null ? [$sku, $ignorerId] : [$sku];
        if (Database::unique($sql, $params) !== null) {
            throw HttpException::validation(['sku' => 'Ce SKU est déjà utilisé par une autre variante.']);
        }
        return $sku;
    }

    /** « Diffuseur bois vase » + « Bois clair » -> « DIF-BOI-CLA » (suffixé si déjà pris). */
    private static function genererSku(string $produitNom, string $libelle): string
    {
        $abreger = static function (string $texte, int $motsMax, int $lettres): string {
            $mots = preg_split('/[^A-Za-z0-9]+/', Slug::creer($texte), -1, PREG_SPLIT_NO_EMPTY) ?: [];
            $mots = array_slice($mots, 0, $motsMax);
            return implode('-', array_map(
                static fn(string $mot): string => strtoupper(substr($mot, 0, $lettres)),
                $mots
            ));
        };

        $base   = trim($abreger($produitNom, 2, 3) . '-' . $abreger($libelle, 1, 3), '-');
        $base   = $base === '' ? 'SKU' : $base;
        $sku     = $base;
        $suffixe = 1;
        while (Database::unique('SELECT id FROM variantes WHERE sku = ?', [$sku]) !== null) {
            $suffixe++;
            $sku = $base . '-' . $suffixe;
        }
        return $sku;
    }

    /**
     * $complet = vue back-office (stock, seuil, SKU). Le prix d'achat n'est
     * ajouté que si le compte connecté est propriétaire.
     */
    public static function presenter(array $ligne, bool $complet): array
    {
        $variante = [
            'id'       => (int) $ligne['id'],
            'libelle'  => $ligne['libelle'],
            'prix'     => (int) $ligne['prix'],
            'en_stock' => (int) $ligne['quantite'] > 0,
        ];

        if (!$complet) {
            return $variante;
        }

        $variante += [
            'produit_id'   => (int) $ligne['produit_id'],
            'sku'          => $ligne['sku'],
            'quantite'     => (int) $ligne['quantite'],
            'seuil_alerte' => (int) $ligne['seuil_alerte'],
            'sous_seuil'   => (int) $ligne['quantite'] <= (int) $ligne['seuil_alerte'],
            'position'     => (int) $ligne['position'],
            'actif'        => (bool) $ligne['actif'],
        ];

        if (Auth::estProprietaire()) {
            $variante['prix_achat'] = $ligne['prix_achat'] !== null ? (int) $ligne['prix_achat'] : null;
            $variante['marge']      = $ligne['prix_achat'] !== null
                ? (int) $ligne['prix'] - (int) $ligne['prix_achat']
                : null;
        }

        return $variante;
    }
}
