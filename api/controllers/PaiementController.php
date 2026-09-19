<?php
declare(strict_types=1);

/**
 * Retour du client après la page de paiement SasPay.
 *
 * Le client revient avec le jeton de son lien (?j=...) et demande au
 * serveur de relire son paiement. Il ne transmet aucun statut : le
 * serveur interroge SasPay et répond ce que SasPay a confirmé.
 */
final class PaiementController
{
    /** POST /paiements/verifier — { jeton } */
    public static function verifier(Request $requete): void
    {
        // Un client patient relit son paiement toutes les quelques secondes ;
        // au-delà, c'est quelqu'un qui essaie des jetons au hasard.
        Throttle::limiter('paiement:' . sha1($requete->ip()), 60, 600);

        $v     = new Validator($requete->corps());
        $jeton = $v->chaine('jeton', true, 32, 32);
        $v->valider();

        $paiement = Paiement::parJeton((string) $jeton)
            ?? throw HttpException::introuvable('Lien de paiement inconnu.');

        $injoignable = false;
        try {
            $paiement = Paiement::verifier($paiement, true);
        } catch (RuntimeException $e) {
            error_log('[darou-minane] retour de paiement — ' . $e->getMessage());
            $injoignable = true;
        }

        $commande = Commande::parId((int) $paiement['commande_id'])
            ?? throw HttpException::introuvable('Commande introuvable.');

        Response::json(CommandeController::vuePublique($commande) + [
            'paiement' => [
                'statut'      => $paiement['statut'],
                'injoignable' => $injoignable,
                // Le client peut reprendre la même page de paiement : jamais
                // une seconde, pour qu'il ne puisse pas payer deux fois.
                'url'         => $paiement['statut'] === 'en_attente' && $commande['statut'] !== 'annulee'
                    ? $paiement['checkout_url']
                    : null,
            ],
            'annulee' => $commande['statut'] === 'annulee',
        ]);
    }
}
