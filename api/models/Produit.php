<?php
declare(strict_types=1);

final class Produit
{
    /** Tris autorisés — l'entrée utilisateur ne touche jamais le SQL. */
    private const TRIS = [
        'recent'    => 'p.created_at DESC, p.id DESC',
        'nom'       => 'p.nom ASC',
        'prix_asc'  => 'prix_min ASC, p.nom ASC',
        'prix_desc' => 'prix_max DESC, p.nom ASC',
    ];

    // -----------------------------------------------------------------
    // Boutique publique — ni stock chiffré, ni prix d'achat, ni SKU.
    // -----------------------------------------------------------------

    /**
     * @param array{categorie?: ?string, q?: ?string, prix_min?: ?int, prix_max?: ?int,
     *              tri?: ?string, mis_en_avant?: ?bool, page?: int, par_page?: int} $filtres
     */
    public static function listePublique(array $filtres): array
    {
        [$where, $having, $params] = self::conditionsPubliques($filtres);
        $tri     = self::TRIS[$filtres['tri'] ?? 'recent'] ?? self::TRIS['recent'];
        $page    = max(1, (int) ($filtres['page'] ?? 1));
        $parPage = min(60, max(1, (int) ($filtres['par_page'] ?? 12)));
        $offset  = ($page - 1) * $parPage;

        $base = "FROM produits p
                 JOIN categories c ON c.id = p.categorie_id
                 JOIN variantes v ON v.produit_id = p.id AND v.actif = 1
                 $where
             GROUP BY p.id";

        $total = (int) Database::valeur("SELECT COUNT(*) FROM (SELECT p.id $base $having) AS t", $params);

        $lignes = Database::toutes(
            "SELECT p.id, p.nom, p.slug, p.description, p.mis_en_avant, p.created_at,
                    c.id AS categorie_id, c.nom AS categorie_nom, c.slug AS categorie_slug,
                    MIN(v.prix) AS prix_min, MAX(v.prix) AS prix_max, SUM(v.quantite) AS stock_total
             $base $having
             ORDER BY $tri
             LIMIT " . (int) $parPage . ' OFFSET ' . (int) $offset,
            $params
        );

        return [
            'donnees'  => self::presenterListe($lignes),
            'page'     => $page,
            'par_page' => $parPage,
            'total'    => $total,
        ];
    }

    public static function fichePublique(string $slug): array
    {
        $ligne = Database::unique(
            'SELECT p.*, c.nom AS categorie_nom, c.slug AS categorie_slug
               FROM produits p JOIN categories c ON c.id = p.categorie_id
              WHERE p.slug = ? AND p.actif = 1',
            [$slug]
        ) ?? throw HttpException::introuvable('Produit introuvable.');

        $variantes = Variante::parProduit((int) $ligne['id'], true);
        if ($variantes === []) {
            throw HttpException::introuvable('Produit indisponible.');
        }

        $prix = array_map(static fn(array $v): int => (int) $v['prix'], $variantes);

        return [
            'id'           => (int) $ligne['id'],
            'nom'          => $ligne['nom'],
            'slug'         => $ligne['slug'],
            'description'  => $ligne['description'],
            'mis_en_avant' => (bool) $ligne['mis_en_avant'],
            'categorie'    => [
                'id'   => (int) $ligne['categorie_id'],
                'nom'  => $ligne['categorie_nom'],
                'slug' => $ligne['categorie_slug'],
            ],
            'prix_min'  => min($prix),
            'prix_max'  => max($prix),
            'en_stock'  => array_sum(array_map(static fn(array $v): int => (int) $v['quantite'], $variantes)) > 0,
            'variantes' => array_map(static fn(array $v): array => Variante::presenter($v, false), $variantes),
            'images'    => array_map(ImageProduit::presenter(...), ImageProduit::pourProduit((int) $ligne['id'])),
        ];
    }

    /** @return array{0: string, 1: string, 2: array<int, mixed>} */
    private static function conditionsPubliques(array $filtres): array
    {
        $conditions = ['p.actif = 1'];
        $params     = [];

        if (!empty($filtres['categorie'])) {
            $conditions[] = 'c.slug = ?';
            $params[]     = $filtres['categorie'];
        }
        if (!empty($filtres['q'])) {
            $conditions[] = '(p.nom LIKE ? OR p.description LIKE ?)';
            $recherche    = '%' . str_replace(['%', '_'], ['\%', '\_'], (string) $filtres['q']) . '%';
            $params[]     = $recherche;
            $params[]     = $recherche;
        }
        if (!empty($filtres['mis_en_avant'])) {
            $conditions[] = 'p.mis_en_avant = 1';
        }

        // Le filtre prix garde les produits ayant au moins une variante dans la fourchette.
        $having     = '';
        $conditionsHaving = [];
        if (isset($filtres['prix_min']) && $filtres['prix_min'] !== null) {
            $conditionsHaving[] = 'MAX(v.prix) >= ?';
            $params[]           = (int) $filtres['prix_min'];
        }
        if (isset($filtres['prix_max']) && $filtres['prix_max'] !== null) {
            $conditionsHaving[] = 'MIN(v.prix) <= ?';
            $params[]           = (int) $filtres['prix_max'];
        }
        if ($conditionsHaving !== []) {
            $having = 'HAVING ' . implode(' AND ', $conditionsHaving);
        }

        return ['WHERE ' . implode(' AND ', $conditions), $having, $params];
    }

    private static function presenterListe(array $lignes): array
    {
        $images = ImageProduit::pourProduits(array_map(static fn(array $l): int => (int) $l['id'], $lignes));

        return array_map(static function (array $l) use ($images): array {
            $imagesProduit = $images[(int) $l['id']] ?? [];
            $principale    = $imagesProduit[0] ?? null;

            return [
                'id'           => (int) $l['id'],
                'nom'          => $l['nom'],
                'slug'         => $l['slug'],
                'categorie'    => [
                    'id'   => (int) $l['categorie_id'],
                    'nom'  => $l['categorie_nom'],
                    'slug' => $l['categorie_slug'],
                ],
                'prix_min'     => (int) $l['prix_min'],
                'prix_max'     => (int) $l['prix_max'],
                'en_stock'     => (int) $l['stock_total'] > 0,
                'mis_en_avant' => (bool) $l['mis_en_avant'],
                'image'        => $principale !== null ? ImageProduit::presenter($principale)['url'] : null,
                // Le navigateur choisit la largeur qui convient à son écran.
                'image_srcset' => $principale !== null ? ImageProduit::presenter($principale)['srcset'] : null,
            ];
        }, $lignes);
    }

    // -----------------------------------------------------------------
    // Back-office
    // -----------------------------------------------------------------

    public static function listeAdmin(array $filtres): array
    {
        $conditions = ['1 = 1'];
        $params     = [];

        if (!empty($filtres['q'])) {
            $conditions[] = '(p.nom LIKE ? OR EXISTS (SELECT 1 FROM variantes vs WHERE vs.produit_id = p.id AND vs.sku LIKE ?))';
            $recherche    = '%' . str_replace(['%', '_'], ['\%', '\_'], (string) $filtres['q']) . '%';
            $params[]     = $recherche;
            $params[]     = $recherche;
        }
        if (!empty($filtres['categorie_id'])) {
            $conditions[] = 'p.categorie_id = ?';
            $params[]     = (int) $filtres['categorie_id'];
        }
        if (isset($filtres['actif']) && $filtres['actif'] !== null) {
            $conditions[] = 'p.actif = ?';
            $params[]     = (int) $filtres['actif'];
        }

        $where   = 'WHERE ' . implode(' AND ', $conditions);
        $having  = !empty($filtres['sous_seuil']) ? 'HAVING alertes > 0' : '';
        $page    = max(1, (int) ($filtres['page'] ?? 1));
        $parPage = min(100, max(1, (int) ($filtres['par_page'] ?? 20)));
        $offset  = ($page - 1) * $parPage;

        $base = "FROM produits p
                 JOIN categories c ON c.id = p.categorie_id
            LEFT JOIN variantes v ON v.produit_id = p.id
                 $where
             GROUP BY p.id";

        $total = (int) Database::valeur(
            "SELECT COUNT(*) FROM (SELECT p.id, SUM(v.actif = 1 AND v.quantite <= v.seuil_alerte) AS alertes $base $having) AS t",
            $params
        );

        $lignes = Database::toutes(
            "SELECT p.id, p.nom, p.slug, p.actif, p.mis_en_avant, p.prix_base, p.created_at,
                    c.id AS categorie_id, c.nom AS categorie_nom, c.slug AS categorie_slug,
                    COUNT(v.id) AS nb_variantes,
                    COALESCE(SUM(v.quantite), 0) AS stock_total,
                    COALESCE(MIN(CASE WHEN v.actif = 1 THEN v.prix END), p.prix_base) AS prix_min,
                    COALESCE(MAX(CASE WHEN v.actif = 1 THEN v.prix END), p.prix_base) AS prix_max,
                    SUM(v.actif = 1 AND v.quantite <= v.seuil_alerte) AS alertes
             $base $having
             ORDER BY p.nom
             LIMIT " . (int) $parPage . ' OFFSET ' . (int) $offset,
            $params
        );

        $images = ImageProduit::pourProduits(array_map(static fn(array $l): int => (int) $l['id'], $lignes));

        $donnees = array_map(static function (array $l) use ($images): array {
            $principale = ($images[(int) $l['id']] ?? [])[0] ?? null;
            return [
                'id'           => (int) $l['id'],
                'nom'          => $l['nom'],
                'slug'         => $l['slug'],
                'actif'        => (bool) $l['actif'],
                'mis_en_avant' => (bool) $l['mis_en_avant'],
                'categorie'    => [
                    'id'   => (int) $l['categorie_id'],
                    'nom'  => $l['categorie_nom'],
                    'slug' => $l['categorie_slug'],
                ],
                'nb_variantes' => (int) $l['nb_variantes'],
                'stock_total'  => (int) $l['stock_total'],
                'prix_min'     => (int) $l['prix_min'],
                'prix_max'     => (int) $l['prix_max'],
                'alertes'      => (int) $l['alertes'],
                'image'        => $principale !== null ? ImageProduit::presenter($principale)['url'] : null,
                // Le navigateur choisit la largeur qui convient à son écran.
                'image_srcset' => $principale !== null ? ImageProduit::presenter($principale)['srcset'] : null,
            ];
        }, $lignes);

        return ['donnees' => $donnees, 'page' => $page, 'par_page' => $parPage, 'total' => $total];
    }

    public static function ficheAdmin(int $id): array
    {
        $ligne = Database::unique(
            'SELECT p.*, c.nom AS categorie_nom, c.slug AS categorie_slug
               FROM produits p JOIN categories c ON c.id = p.categorie_id
              WHERE p.id = ?',
            [$id]
        ) ?? throw HttpException::introuvable('Produit introuvable.');

        $variantes = Variante::parProduit($id, false);

        return [
            'id'           => (int) $ligne['id'],
            'nom'          => $ligne['nom'],
            'slug'         => $ligne['slug'],
            'description'  => $ligne['description'],
            'prix_base'    => (int) $ligne['prix_base'],
            'actif'        => (bool) $ligne['actif'],
            'mis_en_avant' => (bool) $ligne['mis_en_avant'],
            'created_at'   => $ligne['created_at'],
            'categorie'    => [
                'id'   => (int) $ligne['categorie_id'],
                'nom'  => $ligne['categorie_nom'],
                'slug' => $ligne['categorie_slug'],
            ],
            'variantes' => array_map(
                static fn(array $v): array => Variante::presenter($v + ['produit_id' => $id], true),
                $variantes
            ),
            'images'    => array_map(ImageProduit::presenter(...), ImageProduit::pourProduit($id)),
        ];
    }

    /**
     * Crée le produit et ses variantes en une transaction. Chaque quantité
     * initiale entre en stock par un mouvement « entree ».
     */
    public static function creer(array $donnees, ?int $utilisateurId): array
    {
        $id = Database::transaction(static function (PDO $pdo) use ($donnees, $utilisateurId): int {
            Categorie::parId((int) $donnees['categorie_id'])
                ?? throw HttpException::validation(['categorie_id' => 'Catégorie inconnue.']);

            $pdo->prepare(
                'INSERT INTO produits (categorie_id, nom, slug, description, prix_base, mis_en_avant, actif)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            )->execute([
                (int) $donnees['categorie_id'],
                $donnees['nom'],
                Slug::unique($donnees['slug'] ?? $donnees['nom'], 'produits'),
                $donnees['description'] ?? null,
                (int) ($donnees['prix_base'] ?? 0),
                (int) ($donnees['mis_en_avant'] ?? false),
                (int) ($donnees['actif'] ?? true),
            ]);
            $produitId = (int) $pdo->lastInsertId();

            $position = 0;
            foreach ($donnees['variantes'] as $variante) {
                $position++;
                $sku = ($variante['sku'] ?? '') !== ''
                    ? strtoupper(trim($variante['sku']))
                    : self::skuAuto($pdo, $donnees['nom'], $variante['libelle']);

                $doublon = $pdo->prepare('SELECT id FROM variantes WHERE sku = ?');
                $doublon->execute([$sku]);
                if ($doublon->fetch() !== false) {
                    throw HttpException::validation(['variantes' => "Le SKU $sku est déjà utilisé."]);
                }

                $pdo->prepare(
                    'INSERT INTO variantes (produit_id, sku, libelle, prix, prix_achat, quantite, seuil_alerte, position, actif)
                     VALUES (?, ?, ?, ?, ?, 0, ?, ?, 1)'
                )->execute([
                    $produitId,
                    $sku,
                    $variante['libelle'],
                    (int) $variante['prix'],
                    $variante['prix_achat'] ?? null,
                    (int) ($variante['seuil_alerte'] ?? 3),
                    $position,
                ]);
                $varianteId = (int) $pdo->lastInsertId();

                $quantite = (int) ($variante['quantite'] ?? 0);
                if ($quantite > 0) {
                    Stock::appliquer($pdo, $varianteId, 'entree', $quantite, 'Stock initial à la création du produit', null, $utilisateurId);
                }
            }

            // prix_base sert de prix d'appel : on l'aligne sur la variante la moins chère.
            $pdo->prepare(
                'UPDATE produits SET prix_base = (SELECT MIN(prix) FROM variantes WHERE produit_id = ?) WHERE id = ?'
            )->execute([$produitId, $produitId]);

            return $produitId;
        });

        return self::ficheAdmin($id);
    }

    private static function skuAuto(PDO $pdo, string $produitNom, string $libelle): string
    {
        $abreger = static function (string $texte, int $motsMax, int $lettres): string {
            $mots = preg_split('/[^A-Za-z0-9]+/', Slug::creer($texte), -1, PREG_SPLIT_NO_EMPTY) ?: [];
            return implode('-', array_map(
                static fn(string $mot): string => strtoupper(substr($mot, 0, $lettres)),
                array_slice($mots, 0, $motsMax)
            ));
        };

        $base    = trim($abreger($produitNom, 2, 3) . '-' . $abreger($libelle, 1, 3), '-') ?: 'SKU';
        $sku     = $base;
        $suffixe = 1;
        $stmt    = $pdo->prepare('SELECT id FROM variantes WHERE sku = ?');
        while (true) {
            $stmt->execute([$sku]);
            if ($stmt->fetch() === false) {
                return $sku;
            }
            $suffixe++;
            $sku = $base . '-' . $suffixe;
        }
    }

    /**
     * Le slug reste stable après création (les liens partagés sur WhatsApp
     * doivent continuer de fonctionner) sauf demande explicite.
     */
    public static function modifier(int $id, array $champs): array
    {
        Database::unique('SELECT id FROM produits WHERE id = ?', [$id])
            ?? throw HttpException::introuvable('Produit introuvable.');

        if (array_key_exists('categorie_id', $champs)) {
            Categorie::parId((int) $champs['categorie_id'])
                ?? throw HttpException::validation(['categorie_id' => 'Catégorie inconnue.']);
        }

        $colonnes = [];
        $valeurs  = [];
        foreach (['categorie_id', 'nom', 'description', 'prix_base', 'mis_en_avant', 'actif'] as $colonne) {
            if (array_key_exists($colonne, $champs)) {
                $colonnes[] = "$colonne = ?";
                $valeurs[]  = in_array($colonne, ['mis_en_avant', 'actif'], true)
                    ? (int) $champs[$colonne]
                    : $champs[$colonne];
            }
        }
        if (array_key_exists('slug', $champs) && $champs['slug'] !== null) {
            $colonnes[] = 'slug = ?';
            $valeurs[]  = Slug::unique($champs['slug'], 'produits', $id);
        }
        if ($colonnes !== []) {
            $valeurs[] = $id;
            Database::requete('UPDATE produits SET ' . implode(', ', $colonnes) . ' WHERE id = ?', $valeurs);
        }
        return self::ficheAdmin($id);
    }

    /**
     * Supprime le produit s'il n'a jamais bougé, le désactive sinon.
     * @return array{supprime: bool, message: string}
     */
    public static function retirer(int $id): array
    {
        Database::unique('SELECT id FROM produits WHERE id = ?', [$id])
            ?? throw HttpException::introuvable('Produit introuvable.');

        $mouvements = (int) Database::valeur(
            'SELECT COUNT(*) FROM mouvements_stock m JOIN variantes v ON v.id = m.variante_id WHERE v.produit_id = ?',
            [$id]
        );
        $lignes = (int) Database::valeur(
            'SELECT COUNT(*) FROM lignes_commande l JOIN variantes v ON v.id = l.variante_id WHERE v.produit_id = ?',
            [$id]
        );

        if ($mouvements === 0 && $lignes === 0) {
            foreach (ImageProduit::pourProduit($id) as $image) {
                ImageProduit::supprimer((int) $image['id']);
            }
            Database::requete('DELETE FROM produits WHERE id = ?', [$id]);
            return ['supprime' => true, 'message' => 'Produit supprimé.'];
        }

        Database::requete('UPDATE produits SET actif = 0 WHERE id = ?', [$id]);
        return [
            'supprime' => false,
            'message'  => 'Produit retiré de la boutique : son historique de ventes et de stock est conservé.',
        ];
    }
}
