<?php
declare(strict_types=1);

/**
 * Commandes — vente comptoir (back-office) et commande en ligne (boutique).
 *
 * Une commande se crée en une seule transaction : numérotation, lignes au
 * prix figé, et sortie de stock par des mouvements « vente ». Si une seule
 * ligne manque de stock, rien n'est écrit.
 */
final class Commande
{
    public const STATUTS = ['nouvelle', 'confirmee', 'en_livraison', 'livree', 'payee', 'annulee'];

    /**
     * @param array{canal: string, client_nom?: ?string, client_telephone?: ?string,
     *              client_quartier?: ?string, client_note?: ?string,
     *              lignes: array<int, array{variante_id: int, quantite: int}>} $donnees
     */
    public static function creer(array $donnees, ?int $utilisateurId): array
    {
        $canal  = $donnees['canal'];
        $lignes = self::fusionnerLignes($donnees['lignes']);

        $id = Database::transaction(static function (PDO $pdo) use ($donnees, $lignes, $canal, $utilisateurId): int {
            $reference = self::genererReference($pdo);
            $statut    = $canal === 'comptoir' ? 'payee' : 'nouvelle';

            $pdo->prepare(
                'INSERT INTO commandes
                    (reference, canal, client_nom, client_telephone, client_quartier, client_note,
                     statut, total, vue, utilisateur_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)'
            )->execute([
                $reference,
                $canal,
                $donnees['client_nom'] ?? 'Client comptoir',
                $donnees['client_telephone'] ?? null,
                $donnees['client_quartier'] ?? null,
                $donnees['client_note'] ?? null,
                $statut,
                $canal === 'comptoir' ? 1 : 0,   // une vente comptoir n'a rien à signaler
                $utilisateurId,
            ]);
            $commandeId = (int) $pdo->lastInsertId();

            $total = 0;
            $insertLigne = $pdo->prepare(
                'INSERT INTO lignes_commande (commande_id, variante_id, libelle_fige, prix_unitaire, quantite)
                 VALUES (?, ?, ?, ?, ?)'
            );

            foreach ($lignes as $varianteId => $quantite) {
                $article = self::verrouillerArticle($pdo, $varianteId);

                $insertLigne->execute([
                    $commandeId,
                    $varianteId,
                    $article['libelle_fige'],
                    $article['prix'],
                    $quantite,
                ]);
                $total += $article['prix'] * $quantite;

                Stock::appliquer(
                    $pdo,
                    $varianteId,
                    'vente',
                    -$quantite,
                    ($canal === 'comptoir' ? 'Vente comptoir ' : 'Commande ') . $reference,
                    $commandeId,
                    $utilisateurId
                );
            }

            $pdo->prepare('UPDATE commandes SET total = ? WHERE id = ?')->execute([$total, $commandeId]);

            return $commandeId;
        });

        return self::parId($id) ?? throw new RuntimeException('Commande non créée.');
    }

    /**
     * Le prix et le libellé sont lus dans la transaction, la variante déjà
     * verrouillée : ce qui est facturé est ce qui était en base à la vente.
     */
    private static function verrouillerArticle(PDO $pdo, int $varianteId): array
    {
        $stmt = $pdo->prepare(
            'SELECT v.prix, v.libelle, v.actif AS variante_active, p.nom, p.actif AS produit_actif
               FROM variantes v JOIN produits p ON p.id = v.produit_id
              WHERE v.id = ?
              FOR UPDATE'
        );
        $stmt->execute([$varianteId]);
        $article = $stmt->fetch();

        if ($article === false) {
            throw HttpException::validation(['lignes' => "Article #$varianteId introuvable."]);
        }
        if ((int) $article['variante_active'] !== 1 || (int) $article['produit_actif'] !== 1) {
            throw HttpException::conflit(
                sprintf('%s — %s n\'est plus en vente.', $article['nom'], $article['libelle'])
            );
        }

        return [
            'prix'         => (int) $article['prix'],
            'libelle_fige' => $article['nom'] . ' — ' . $article['libelle'],
        ];
    }

    /** Numérotation CMD-AAAA-NNNN, sans trou ni doublon (compteur verrouillé). */
    private static function genererReference(PDO $pdo): string
    {
        $annee = (int) date('Y');

        $pdo->prepare(
            'INSERT INTO compteurs_commandes (annee, dernier_numero) VALUES (?, 0)
             ON DUPLICATE KEY UPDATE annee = annee'
        )->execute([$annee]);

        $stmt = $pdo->prepare('SELECT dernier_numero FROM compteurs_commandes WHERE annee = ? FOR UPDATE');
        $stmt->execute([$annee]);
        $numero = (int) $stmt->fetchColumn() + 1;

        $pdo->prepare('UPDATE compteurs_commandes SET dernier_numero = ? WHERE annee = ?')
            ->execute([$numero, $annee]);

        return sprintf('CMD-%d-%04d', $annee, $numero);
    }

    /**
     * Deux fois le même article dans le panier = une seule ligne cumulée
     * (la base l'impose, et une facture avec deux lignes identiques est fausse).
     * @return array<int, int> variante_id => quantité
     */
    private static function fusionnerLignes(array $lignes): array
    {
        $fusionnees = [];
        foreach ($lignes as $ligne) {
            $varianteId = (int) $ligne['variante_id'];
            $quantite   = (int) $ligne['quantite'];
            $fusionnees[$varianteId] = ($fusionnees[$varianteId] ?? 0) + $quantite;
        }
        if ($fusionnees === []) {
            throw HttpException::validation(['lignes' => 'Le panier est vide.']);
        }
        return $fusionnees;
    }

    public static function parId(int $id): ?array
    {
        $ligne = Database::unique(
            'SELECT c.*, u.nom AS vendeur_nom
               FROM commandes c LEFT JOIN utilisateurs u ON u.id = c.utilisateur_id
              WHERE c.id = ?',
            [$id]
        );
        return $ligne === null ? null : self::presenter($ligne, true);
    }

    public static function presenter(array $ligne, bool $avecLignes): array
    {
        $commande = [
            'id'               => (int) $ligne['id'],
            'reference'        => $ligne['reference'],
            'canal'            => $ligne['canal'],
            'statut'           => $ligne['statut'],
            'total'            => (int) $ligne['total'],
            'vue'              => (bool) $ligne['vue'],
            'client_nom'       => $ligne['client_nom'],
            'client_telephone' => $ligne['client_telephone'],
            'client_quartier'  => $ligne['client_quartier'],
            'client_note'      => $ligne['client_note'],
            'vendeur'          => $ligne['vendeur_nom'] ?? null,
            'created_at'       => $ligne['created_at'],
        ];

        if ($avecLignes) {
            $commande['lignes'] = array_map(static fn(array $l): array => [
                'id'            => (int) $l['id'],
                'variante_id'   => $l['variante_id'] !== null ? (int) $l['variante_id'] : null,
                'libelle'       => $l['libelle_fige'],
                'prix_unitaire' => (int) $l['prix_unitaire'],
                'quantite'      => (int) $l['quantite'],
                'total_ligne'   => (int) $l['total_ligne'],
            ], Database::toutes(
                'SELECT * FROM lignes_commande WHERE commande_id = ? ORDER BY id',
                [(int) $ligne['id']]
            ));
        }

        return $commande;
    }
}
