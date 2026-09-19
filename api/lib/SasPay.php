<?php
declare(strict_types=1);

/**
 * Client de l'API SasPay (https://docs.saspay.me) : encaissement mobile
 * money (Wave, Orange Money, Free Money…) par page de paiement hébergée.
 *
 * La clé secrète ne quitte jamais le serveur : le navigateur ne reçoit
 * que l'adresse de la page de paiement. Aucun statut n'est cru sur
 * parole, ni celui du navigateur ni celui d'une session : un paiement
 * n'est tenu pour reçu qu'après relecture de la transaction elle-même
 * (voir Paiement::verifier()).
 *
 * Pas de webhook : l'hébergement gratuit (InfinityFree) sert une page
 * anti-robot à toute requête qui ne vient pas d'un navigateur, les
 * notifications de SasPay n'arriveraient jamais. C'est donc le serveur
 * qui interroge SasPay — au retour du client, et à l'ouverture de la
 * commande dans le back-office.
 */
final class SasPay
{
    private const URL_API = 'https://api.saspay.me/api/v1';

    /** Sans clé configurée, la boutique ne propose que le paiement à la livraison. */
    public static function actif(): bool
    {
        return self::cle() !== '';
    }

    /**
     * SasPay refuse une page de paiement sans e-mail client (400). Sans
     * e-mail de boutique pour le remplacer, le client doit donner le sien.
     */
    public static function emailRequis(): bool
    {
        return trim((string) Config::get('paiement.saspay.email_par_defaut', '')) === '';
    }

    /**
     * @param array<string, mixed> $donnees corps de POST /checkout-sessions/
     * @return array{id: string, checkout_url: string, status?: string}
     */
    public static function creerSession(array $donnees): array
    {
        $session = self::appeler('POST', '/checkout-sessions/', $donnees);
        if (empty($session['id']) || empty($session['checkout_url'])) {
            throw new RuntimeException('SasPay : session de paiement incomplète.');
        }
        return $session;
    }

    public static function session(string $id): array
    {
        return self::appeler('GET', '/checkout-sessions/' . rawurlencode($id) . '/');
    }

    public static function annulerSession(string $id): array
    {
        return self::appeler('POST', '/checkout-sessions/' . rawurlencode($id) . '/cancel/');
    }

    /** Relit l'état réel de la transaction auprès de l'opérateur. */
    public static function transaction(string $id): array
    {
        return self::appeler('GET', '/payments/' . rawurlencode($id) . '/verify/');
    }

    private static function cle(): string
    {
        return trim((string) Config::get('paiement.saspay.cle_api', ''));
    }

    /** @return array<string, mixed> */
    private static function appeler(string $methode, string $chemin, ?array $corps = null): array
    {
        if (!self::actif()) {
            throw new RuntimeException('SasPay : aucune clé API configurée.');
        }

        $url     = rtrim((string) Config::get('paiement.saspay.url_api', self::URL_API), '/') . $chemin;
        $entetes = ['Authorization: Bearer ' . self::cle(), 'Accept: application/json'];
        $options = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => $methode,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT        => 20,
        ];
        if ($corps !== null) {
            $entetes[]                     = 'Content-Type: application/json';
            $options[CURLOPT_POSTFIELDS]   = json_encode($corps, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
        $options[CURLOPT_HTTPHEADER] = $entetes;

        $curl = curl_init($url);
        curl_setopt_array($curl, $options);
        $brut   = curl_exec($curl);
        $statut = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $erreur = curl_error($curl);

        if ($brut === false) {
            throw new RuntimeException("SasPay injoignable : $erreur");
        }
        $json = json_decode((string) $brut, true);
        if (!is_array($json)) {
            throw new RuntimeException("SasPay : réponse illisible (HTTP $statut).");
        }

        // La documentation annonce une enveloppe { success, data, code },
        // certains de ses exemples renvoient l'objet nu : on accepte les deux.
        $enveloppe = array_key_exists('success', $json) && array_key_exists('data', $json);
        if ($statut < 200 || $statut >= 300 || ($json['success'] ?? true) === false) {
            $message = $json['error']['message'] ?? $json['message'] ?? $json['error'] ?? "HTTP $statut";
            throw new RuntimeException('SasPay : ' . (is_string($message)
                ? $message
                : json_encode($message, JSON_UNESCAPED_UNICODE)));
        }

        $donnees = $enveloppe ? $json['data'] : $json;
        return is_array($donnees) ? $donnees : [];
    }
}
