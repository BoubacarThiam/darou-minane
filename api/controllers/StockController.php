<?php
declare(strict_types=1);

/**
 * Module Stock. Un employé peut enregistrer une entrée de marchandise ;
 * les pertes et les ajustements d'inventaire restent au propriétaire.
 */
final class StockController
{
    /** GET /admin/stock/mouvements */
    public static function mouvements(Request $requete): void
    {
        Auth::exigerAuth($requete);

        $v = new Validator([
            'variante_id' => $requete->query('variante_id'),
            'type'        => $requete->query('type'),
            'page'        => $requete->query('page'),
            'par_page'    => $requete->query('par_page'),
        ]);
        $varianteId = $v->entier('variante_id', false, 1);
        $type       = $v->parmi('type', Stock::TYPES, false);
        $page       = (int) $v->entier('page', false, 1, 10_000, 1);
        $parPage    = (int) $v->entier('par_page', false, 1, 100, 30);
        $v->valider();

        $total = Stock::compterHistorique($varianteId, $type);
        $liste = Stock::historique($varianteId, $type, $parPage, ($page - 1) * $parPage);

        Response::liste($liste, $page, $parPage, $total);
    }

    /**
     * POST /admin/stock/mouvements
     *   entree     : { variante_id, type: "entree", quantite: 12, motif }
     *   perte      : { variante_id, type: "perte", quantite: 2, motif }
     *   ajustement : { variante_id, type: "ajustement", quantite_reelle: 7, motif }
     */
    public static function creerMouvement(Request $requete): void
    {
        $utilisateur = Auth::exigerAuth($requete);

        $v    = new Validator($requete->corps());
        $type = $v->parmi('type', Stock::TYPES_MANUELS, true);
        $varianteId = $v->entier('variante_id', true, 1);
        $motif      = $v->chaine('motif', false, 0, 255);

        $quantite       = null;
        $quantiteReelle = null;
        if ($type === 'ajustement') {
            $quantiteReelle = $v->entier('quantite_reelle', true, 0, 1_000_000);
        } else {
            $quantite = $v->entier('quantite', true, 1, 1_000_000);
        }
        $v->valider();

        if ($type !== 'entree' && $utilisateur['role'] !== 'proprietaire') {
            throw HttpException::interdit('Seul le propriétaire enregistre les pertes et les ajustements.');
        }

        $resultat = Database::transaction(
            static function (PDO $pdo) use ($type, $varianteId, $quantite, $quantiteReelle, $motif, $utilisateur): array {
                if ($type === 'ajustement') {
                    $nouvelle = Stock::ajusterA($pdo, (int) $varianteId, (int) $quantiteReelle, $motif, $utilisateur['id']);
                    return $nouvelle === null
                        ? ['modifie' => false, 'quantite' => (int) $quantiteReelle,
                           'message'  => 'Stock déjà conforme : aucun mouvement enregistré.']
                        : ['modifie' => true, 'quantite' => $nouvelle, 'message' => 'Inventaire enregistré.'];
                }

                $delta    = $type === 'perte' ? -(int) $quantite : (int) $quantite;
                $nouvelle = Stock::appliquer($pdo, (int) $varianteId, $type, $delta, $motif, null, $utilisateur['id']);

                return [
                    'modifie'  => true,
                    'quantite' => $nouvelle,
                    'message'  => $type === 'entree' ? 'Entrée de stock enregistrée.' : 'Perte enregistrée.',
                ];
            }
        );

        $variante = Variante::parId((int) $varianteId);
        Response::json($resultat + ['variante' => Variante::presenter($variante, true)], 201);
    }

    /** GET /admin/stock/alertes */
    public static function alertes(Request $requete): void
    {
        Auth::exigerAuth($requete);
        Response::json(Stock::sousSeuil());
    }
}
