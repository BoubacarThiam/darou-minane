<?php
declare(strict_types=1);

final class Database
{
    private static ?PDO $pdo = null;

    public static function pdo(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $cfg    = Config::get('db');
        $socket = $cfg['socket'] ?? null;
        $dsn = $socket
            ? sprintf('mysql:unix_socket=%s;dbname=%s;charset=utf8mb4', $socket, $cfg['nom'])
            : sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $cfg['host'], (int) ($cfg['port'] ?? 3306), $cfg['nom']);

        self::$pdo = new PDO($dsn, $cfg['utilisateur'], $cfg['mot_de_passe'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
            PDO::ATTR_STRINGIFY_FETCHES  => false,
            PDO::MYSQL_ATTR_INIT_COMMAND =>
                "SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION', time_zone = '+00:00'",
        ]);

        return self::$pdo;
    }

    /**
     * Exécute $travail dans une transaction : COMMIT si tout passe,
     * ROLLBACK à la moindre exception. Tout mouvement de stock passe par ici.
     */
    public static function transaction(callable $travail): mixed
    {
        $pdo = self::pdo();
        $pdo->beginTransaction();
        try {
            $resultat = $travail($pdo);
            $pdo->commit();
            return $resultat;
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    public static function requete(string $sql, array $parametres = []): PDOStatement
    {
        $stmt = self::pdo()->prepare($sql);
        $stmt->execute($parametres);
        return $stmt;
    }

    public static function unique(string $sql, array $parametres = []): ?array
    {
        $ligne = self::requete($sql, $parametres)->fetch();
        return $ligne === false ? null : $ligne;
    }

    public static function toutes(string $sql, array $parametres = []): array
    {
        return self::requete($sql, $parametres)->fetchAll();
    }

    public static function valeur(string $sql, array $parametres = []): mixed
    {
        $valeur = self::requete($sql, $parametres)->fetchColumn();
        return $valeur === false ? null : $valeur;
    }
}
