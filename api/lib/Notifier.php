<?php
declare(strict_types=1);

/**
 * Notifications de commande — POINT UNIQUE de sortie vers l'extérieur.
 *
 * En v1 il n'y a aucun service payant : une commande en ligne lève un
 * drapeau dans le back-office (commandes.vue = 0, badge + son côté React)
 * et le propriétaire ouvre un lien wa.me pré-rempli pour joindre le client.
 *
 * Pour brancher l'API WhatsApp Business (ou un SMS) plus tard, il suffit
 * de compléter envoyer() : aucun autre fichier n'a à changer.
 */
final class Notifier
{
    /** Numéro du commerçant, format international sans « + » ni espaces. */
    public static function numeroBoutique(): string
    {
        return preg_replace('/\D+/', '', (string) Config::get('boutique.whatsapp')) ?? '';
    }

    public static function lien(string $numero, string $texte): string
    {
        $numero = preg_replace('/\D+/', '', $numero) ?? '';
        return 'https://wa.me/' . $numero . '?text=' . rawurlencode($texte);
    }

    /**
     * Récapitulatif lisible d'une commande — sert aussi bien au message
     * WhatsApp qu'à un futur SMS.
     */
    public static function recapitulatif(array $commande, bool $pourLeClient): string
    {
        $boutique = (string) Config::get('boutique.nom');
        $lignes   = [];

        foreach ($commande['lignes'] ?? [] as $ligne) {
            $lignes[] = sprintf(
                '- %s x%d : %s',
                $ligne['libelle'],
                $ligne['quantite'],
                self::montant($ligne['total_ligne'])
            );
        }

        $entete = $pourLeClient
            ? sprintf('Bonjour, ma commande %s sur %s :', $commande['reference'], $boutique)
            : sprintf('%s — commande %s', $boutique, $commande['reference']);

        $corps = array_filter([
            $entete,
            '',
            implode("\n", $lignes),
            'Total : ' . self::montant($commande['total']),
            'Livraison : à convenir (' . Config::get('boutique.zone_livraison') . ')',
            '',
            $pourLeClient
                ? null
                : 'Client : ' . $commande['client_nom']
                    . ($commande['client_telephone'] ? ' — ' . $commande['client_telephone'] : ''),
            $pourLeClient || empty($commande['client_quartier'])
                ? null
                : 'Repère : ' . $commande['client_quartier'],
            $pourLeClient || empty($commande['client_note'])
                ? null
                : 'Note : ' . $commande['client_note'],
        ], static fn($ligne): bool => $ligne !== null);

        return implode("\n", $corps);
    }

    /**
     * Liens prêts à l'emploi joints à chaque commande :
     *  - « client »   : le commerçant écrit au client (confirmation, livraison) ;
     *  - « boutique » : le client écrit à la boutique (bouton « Suivre ma commande »).
     */
    public static function liensCommande(array $commande): array
    {
        $telephoneClient = $commande['client_telephone'] ?? null;

        return [
            'client' => $telephoneClient
                ? self::lien($telephoneClient, self::messageAuClient($commande))
                : null,
            'boutique' => self::lien(self::numeroBoutique(), self::recapitulatif($commande, true)),
        ];
    }

    private static function messageAuClient(array $commande): string
    {
        return sprintf(
            "Bonjour %s, ici %s. Votre commande %s est bien reçue :\n%s\nTotal : %s\nLivraison : à convenir. Quand souhaitez-vous être livré(e) ?",
            $commande['client_nom'],
            (string) Config::get('boutique.nom'),
            $commande['reference'],
            implode("\n", array_map(
                static fn(array $l): string => sprintf('- %s x%d', $l['libelle'], $l['quantite']),
                $commande['lignes'] ?? []
            )),
            self::montant($commande['total'])
        );
    }

    /**
     * Appelé à chaque commande en ligne. Aujourd'hui : trace serveur, le
     * signal visible étant commandes.vue = 0 (badge + son du back-office).
     * Demain : envoi WhatsApp Business ou SMS, ici et nulle part ailleurs.
     */
    public static function nouvelleCommande(array $commande): void
    {
        error_log(sprintf(
            '[darou-minane] nouvelle commande %s — %s — %s',
            $commande['reference'],
            $commande['client_nom'],
            self::montant($commande['total'])
        ));
    }

    private static function montant(int $valeur): string
    {
        return number_format($valeur, 0, ',', ' ') . ' ' . Config::get('boutique.devise', 'FCFA');
    }
}
