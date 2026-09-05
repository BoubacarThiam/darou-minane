<?php
declare(strict_types=1);

/**
 * Service de mouvement de stock — LE SEUL POINT D'ÉCRITURE de
 * variantes.quantite dans toute l'application.
 *
 * Invariant tenu ici : chaque modification de quantité produit sa ligne
 * dans mouvements_stock, dans la même transaction. La variante est
 * verrouillée (SELECT ... FOR UPDATE) le temps du calcul, ce qui empêche
 * deux ventes simultanées de vendre le même dernier article.
 */
final class Stock
{
    public const TYPES = ['entree', 'vente', 'retour', 'perte', 'ajustement'];

    /** Types qu'un employé peut déclencher depuis le module Stock. */
    public const TYPES_MANUELS = ['entree', 'perte', 'ajustement'];

    public static function appliquer(
        PDO $pdo,
        int $varianteId,
        string $type,
        int $delta,
        ?string $motif = null,
        ?int $commandeId = null,
        ?int $utilisateurId = null
    ): int {
        if (!$pdo->inTransaction()) {
            throw new LogicException('Stock::appliquer() doit être appelé dans une transaction.');
        }
        if (!in_array($type, self::TYPES, true)) {
            throw new InvalidArgumentException("Type de mouvement inconnu : $type");
        }
        if ($delta === 0) {
            throw HttpException::validation(['quantite' => 'La quantité ne peut pas être nulle.']);
        }

        $stmt = $pdo->prepare(
            'SELECT v.quantite, v.libelle, p.nom
               FROM variantes v
               JOIN produits p ON p.id = v.produit_id
              WHERE v.id = ?
              FOR UPDATE'
        );
        $stmt->execute([$varianteId]);
        $variante = $stmt->fetch();
        if ($variante === false) {
            throw HttpException::introuvable("Variante #$varianteId introuvable.");
        }

        $actuelle = (int) $variante['quantite'];
        $nouvelle = $actuelle + $delta;
        if ($nouvelle < 0) {
            throw HttpException::conflit(sprintf(
                'Stock insuffisant pour %s — %s : %d en stock, %d demandé(s).',
                $variante['nom'],
                $variante['libelle'],
                $actuelle,
                abs($delta)
            ));
        }

        $pdo->prepare('UPDATE variantes SET quantite = ? WHERE id = ?')
            ->execute([$nouvelle, $varianteId]);

        $pdo->prepare(
            'INSERT INTO mouvements_stock
                (variante_id, type, quantite, quantite_apres, motif, commande_id, utilisateur_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        )->execute([$varianteId, $type, $delta, $nouvelle, $motif, $commandeId, $utilisateurId]);

        return $nouvelle;
    }

    /**
     * Inventaire : on saisit le stock réellement compté en rayon et le
     * service en déduit l'écart à enregistrer. Renvoie null si rien ne bouge.
     */
    public static function ajusterA(
        PDO $pdo,
        int $varianteId,
        int $quantiteReelle,
        ?string $motif,
        ?int $utilisateurId
    ): ?int {
        if (!$pdo->inTransaction()) {
            throw new LogicException('Stock::ajusterA() doit être appelé dans une transaction.');
        }
        $stmt = $pdo->prepare('SELECT quantite FROM variantes WHERE id = ? FOR UPDATE');
        $stmt->execute([$varianteId]);
        $actuelle = $stmt->fetchColumn();
        if ($actuelle === false) {
            throw HttpException::introuvable("Variante #$varianteId introuvable.");
        }

        $delta = $quantiteReelle - (int) $actuelle;
        if ($delta === 0) {
            return null;
        }
        return self::appliquer($pdo, $varianteId, 'ajustement', $delta, $motif, null, $utilisateurId);
    }

    /** Historique des mouvements, filtrable par variante et par type. */
    public static function historique(?int $varianteId, ?string $type, int $limite, int $offset): array
    {
        [$where, $params] = self::filtres($varianteId, $type);
        $lignes = Database::toutes(
            "SELECT m.id, m.type, m.quantite, m.quantite_apres, m.motif, m.created_at,
                    m.commande_id, c.reference AS commande_reference,
                    m.variante_id, v.sku, v.libelle, p.id AS produit_id, p.nom AS produit_nom,
                    u.nom AS utilisateur_nom
               FROM mouvements_stock m
               JOIN variantes v ON v.id = m.variante_id
               JOIN produits p ON p.id = v.produit_id
          LEFT JOIN commandes c ON c.id = m.commande_id
          LEFT JOIN utilisateurs u ON u.id = m.utilisateur_id
              $where
           ORDER BY m.created_at DESC, m.id DESC
              LIMIT " . (int) $limite . ' OFFSET ' . (int) $offset,
            $params
        );

        return array_map(static fn(array $l): array => [
            'id'                 => (int) $l['id'],
            'type'               => $l['type'],
            'quantite'           => (int) $l['quantite'],
            'quantite_apres'     => (int) $l['quantite_apres'],
            'motif'              => $l['motif'],
            'created_at'         => $l['created_at'],
            'commande_id'        => $l['commande_id'] !== null ? (int) $l['commande_id'] : null,
            'commande_reference' => $l['commande_reference'],
            'utilisateur'        => $l['utilisateur_nom'],
            'variante'           => [
                'id'          => (int) $l['variante_id'],
                'sku'         => $l['sku'],
                'libelle'     => $l['libelle'],
                'produit_id'  => (int) $l['produit_id'],
                'produit_nom' => $l['produit_nom'],
            ],
        ], $lignes);
    }

    public static function compterHistorique(?int $varianteId, ?string $type): int
    {
        [$where, $params] = self::filtres($varianteId, $type);
        return (int) Database::valeur("SELECT COUNT(*) FROM mouvements_stock m $where", $params);
    }

    /** @return array{0: string, 1: array<int, mixed>} */
    private static function filtres(?int $varianteId, ?string $type): array
    {
        $conditions = [];
        $params     = [];
        if ($varianteId !== null) {
            $conditions[] = 'm.variante_id = ?';
            $params[]     = $varianteId;
        }
        if ($type !== null) {
            $conditions[] = 'm.type = ?';
            $params[]     = $type;
        }
        return [$conditions === [] ? '' : 'WHERE ' . implode(' AND ', $conditions), $params];
    }

    /** Variantes actives dont le stock est retombé au niveau d'alerte. */
    public static function sousSeuil(): array
    {
        $lignes = Database::toutes(
            'SELECT v.id, v.sku, v.libelle, v.quantite, v.seuil_alerte,
                    p.id AS produit_id, p.nom AS produit_nom
               FROM variantes v
               JOIN produits p ON p.id = v.produit_id
              WHERE v.actif = 1 AND p.actif = 1 AND v.quantite <= v.seuil_alerte
           ORDER BY v.quantite, p.nom'
        );

        return array_map(static fn(array $l): array => [
            'variante_id'  => (int) $l['id'],
            'sku'          => $l['sku'],
            'libelle'      => $l['libelle'],
            'quantite'     => (int) $l['quantite'],
            'seuil_alerte' => (int) $l['seuil_alerte'],
            'produit_id'   => (int) $l['produit_id'],
            'produit_nom'  => $l['produit_nom'],
        ], $lignes);
    }
}
