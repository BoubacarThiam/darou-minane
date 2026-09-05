<?php
declare(strict_types=1);

final class CommandeController
{
    /**
     * POST /admin/commandes — vente au comptoir.
     * Le canal est imposé côté serveur : cette route ne crée jamais une
     * commande « en ligne » (la boutique publique a son propre point d'entrée).
     */
    public static function venteComptoir(Request $requete): void
    {
        $utilisateur = Auth::exigerAuth($requete);

        $v      = new Validator($requete->corps());
        $lignes = $v->tableau('lignes', true, 1, 50);
        $donnees = [
            'canal'            => 'comptoir',
            'client_nom'       => $v->chaine('client_nom', false, 2, 120, 'Client comptoir'),
            'client_telephone' => $v->telephone('client_telephone', false),
            'client_note'      => $v->texte('client_note', false, 1000),
            'lignes'           => self::validerLignes($v, $lignes ?? []),
        ];
        $v->valider();

        Response::json(Commande::creer($donnees, $utilisateur['id']), 201);
    }

    /** GET /admin/commandes/{id} */
    public static function show(Request $requete, array $parametres): void
    {
        Auth::exigerAuth($requete);

        $id = (int) ($parametres['id'] ?? 0);
        Response::json(Commande::parId($id) ?? throw HttpException::introuvable('Commande introuvable.'));
    }

    private static function validerLignes(Validator $v, array $lignes): array
    {
        $propres = [];
        foreach (array_values($lignes) as $index => $ligne) {
            if (!is_array($ligne)) {
                $v->ajouterErreur("lignes.$index", 'Ligne invalide.');
                continue;
            }
            $vl = new Validator($ligne);
            $propres[] = [
                'variante_id' => $vl->entier('variante_id', true, 1),
                'quantite'    => $vl->entier('quantite', true, 1, 10_000),
            ];
            try {
                $vl->valider();
            } catch (HttpException $e) {
                foreach ($e->champs() as $champ => $message) {
                    $v->ajouterErreur("lignes.$index.$champ", $message);
                }
            }
        }
        return $propres;
    }
}
