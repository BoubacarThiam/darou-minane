<?php
declare(strict_types=1);

final class Slug
{
    /** « Diffuseur bois vase » -> « diffuseur-bois-vase » */
    public static function creer(string $texte): string
    {
        $translitteré = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $texte);
        if ($translitteré === false) {
            $translitteré = $texte;
        }
        $slug = strtolower((string) preg_replace('/[^a-zA-Z0-9]+/', '-', $translitteré));
        $slug = trim($slug, '-');
        return $slug === '' ? 'element' : substr($slug, 0, 150);
    }

    /**
     * Rend le slug unique dans $table en suffixant -2, -3, ... si besoin.
     * $ignorerId permet de modifier un enregistrement sans buter sur lui-même.
     */
    public static function unique(string $texte, string $table, ?int $ignorerId = null): string
    {
        $base   = self::creer($texte);
        $slug   = $base;
        $suffixe = 1;
        while (true) {
            $sql = "SELECT id FROM `$table` WHERE slug = ?" . ($ignorerId !== null ? ' AND id <> ?' : '') . ' LIMIT 1';
            $params = $ignorerId !== null ? [$slug, $ignorerId] : [$slug];
            if (Database::unique($sql, $params) === null) {
                return $slug;
            }
            $suffixe++;
            $slug = $base . '-' . $suffixe;
        }
    }
}
