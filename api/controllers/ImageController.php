<?php
declare(strict_types=1);

final class ImageController
{
    /**
     * POST /admin/produits/{id}/images — multipart/form-data, champ « images[] ».
     * Les fichiers sont recompressés et redimensionnés côté serveur.
     */
    public static function store(Request $requete, array $parametres): void
    {
        Auth::exigerProprietaire($requete);

        $produitId = (int) ($parametres['id'] ?? 0);
        Database::unique('SELECT id FROM produits WHERE id = ?', [$produitId])
            ?? throw HttpException::introuvable('Produit introuvable.');

        $fichiers = self::normaliserFichiers($_FILES['images'] ?? null);
        if ($fichiers === []) {
            throw HttpException::validation(['images' => 'Aucune image reçue.']);
        }
        $maximum = (int) Config::get('uploads.fichiers_max', 6);
        if (count($fichiers) > $maximum) {
            throw HttpException::validation(['images' => "Au plus $maximum images par envoi."]);
        }

        $varianteId = null;
        if (isset($_POST['variante_id']) && $_POST['variante_id'] !== '') {
            $varianteId = (int) $_POST['variante_id'];
            $variante   = Variante::parId($varianteId);
            if ($variante === null || (int) $variante['produit_id'] !== $produitId) {
                throw HttpException::validation(['variante_id' => 'Cette variante n\'appartient pas au produit.']);
            }
        }

        $creees = [];
        foreach ($fichiers as $fichier) {
            $chemin   = ImageService::enregistrer($fichier);
            $creees[] = ImageProduit::creer($produitId, $chemin, $varianteId, null);
        }

        Response::json($creees, 201);
    }

    /** PUT /admin/images/{id} — position dans la galerie, rattachement à une variante. */
    public static function update(Request $requete, array $parametres): void
    {
        Auth::exigerProprietaire($requete);

        $v      = new Validator($requete->corps());
        $champs = [];
        if ($v->present('position')) { $champs['position'] = $v->entier('position', true, 0, 1000); }
        if ($v->present('variante_id')) {
            $champs['variante_id'] = $requete->corps()['variante_id'] === null
                ? null
                : $v->entier('variante_id', true, 1);
        }
        $v->valider();

        Response::json(ImageProduit::modifier(self::id($parametres), $champs));
    }

    /** DELETE /admin/images/{id} */
    public static function destroy(Request $requete, array $parametres): void
    {
        Auth::exigerProprietaire($requete);
        ImageProduit::supprimer(self::id($parametres));
        Response::vide();
    }

    /**
     * $_FILES range un envoi multiple en colonnes ; on le remet en lignes.
     * @return array<int, array{name: string, type: string, tmp_name: string, error: int, size: int}>
     */
    private static function normaliserFichiers(?array $champ): array
    {
        if ($champ === null) {
            return [];
        }
        if (!is_array($champ['name'])) {
            return $champ['error'] === UPLOAD_ERR_NO_FILE ? [] : [$champ];
        }

        $fichiers = [];
        foreach (array_keys($champ['name']) as $index) {
            if ($champ['error'][$index] === UPLOAD_ERR_NO_FILE) {
                continue;
            }
            $fichiers[] = [
                'name'     => $champ['name'][$index],
                'type'     => $champ['type'][$index],
                'tmp_name' => $champ['tmp_name'][$index],
                'error'    => $champ['error'][$index],
                'size'     => $champ['size'][$index],
            ];
        }
        return $fichiers;
    }

    private static function id(array $parametres): int
    {
        $id = (int) ($parametres['id'] ?? 0);
        if ($id < 1) {
            throw HttpException::introuvable('Identifiant d\'image invalide.');
        }
        return $id;
    }
}
