<?php
declare(strict_types=1);

/**
 * Chiffres d'ouverture du back-office. Les montants (chiffre d'affaires,
 * panier moyen) ne sont calculés que pour le propriétaire : un employé voit
 * l'activité du jour et le travail à faire, pas les résultats de la boutique.
 */
final class TableauDeBord
{
    public static function resume(bool $avecMontants): array
    {
        $jour = Database::unique(
            "SELECT COUNT(*) AS nb,
                    COALESCE(SUM(total), 0) AS total,
                    COALESCE(SUM(canal = 'comptoir'), 0) AS nb_comptoir,
                    COALESCE(SUM(canal = 'en_ligne'), 0) AS nb_en_ligne
               FROM commandes
              WHERE statut <> 'annulee' AND DATE(created_at) = CURDATE()"
        ) ?? ['nb' => 0, 'total' => 0, 'nb_comptoir' => 0, 'nb_en_ligne' => 0];

        $parStatut = [];
        foreach (Database::toutes(
            "SELECT statut, COUNT(*) AS nb FROM commandes
              WHERE statut IN ('nouvelle', 'confirmee', 'en_livraison', 'livree')
           GROUP BY statut"
        ) as $ligne) {
            $parStatut[$ligne['statut']] = (int) $ligne['nb'];
        }

        $alertes = Stock::sousSeuil();

        $resume = [
            'ventes_du_jour' => [
                'nb'          => (int) $jour['nb'],
                'nb_comptoir' => (int) $jour['nb_comptoir'],
                'nb_en_ligne' => (int) $jour['nb_en_ligne'],
            ],
            'commandes_en_attente' => [
                'nouvelle'     => $parStatut['nouvelle'] ?? 0,
                'confirmee'    => $parStatut['confirmee'] ?? 0,
                'en_livraison' => $parStatut['en_livraison'] ?? 0,
                'livree'       => $parStatut['livree'] ?? 0,
                'total'        => array_sum($parStatut),
            ],
            'non_vues' => Commande::nombreNonVues(),
            'alertes'  => [
                'nb'    => count($alertes),
                'liste' => array_slice($alertes, 0, 5),
            ],
            'dernieres_commandes' => Commande::liste(['par_page' => 5])['donnees'],
        ];

        if ($avecMontants) {
            $resume['ventes_du_jour']['total'] = (int) $jour['total'];
            $resume['ventes_du_jour']['panier_moyen'] = (int) $jour['nb'] > 0
                ? (int) round((int) $jour['total'] / (int) $jour['nb'])
                : 0;
            $resume['valeur_stock'] = [
                'prix_vente' => (int) Database::valeur(
                    'SELECT COALESCE(SUM(v.prix * v.quantite), 0) FROM variantes v
                       JOIN produits p ON p.id = v.produit_id WHERE v.actif = 1 AND p.actif = 1'
                ),
                'prix_achat' => (int) Database::valeur(
                    'SELECT COALESCE(SUM(COALESCE(v.prix_achat, 0) * v.quantite), 0) FROM variantes v
                       JOIN produits p ON p.id = v.produit_id WHERE v.actif = 1 AND p.actif = 1'
                ),
            ];
        }

        return $resume;
    }
}
