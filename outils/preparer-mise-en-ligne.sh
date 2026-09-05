#!/usr/bin/env bash
#
# Prépare le dossier à téléverser sur l'hébergement mutualisé.
# Usage : ./outils/preparer-mise-en-ligne.sh
#
# Le résultat, mise-en-ligne/, contient exactement ce qui doit se retrouver
# dans public_html : la boutique compilée, l'API PHP et les fichiers SQL.
# Aucun outil n'est nécessaire sur le serveur (ni Node, ni Composer).

set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SORTIE="$RACINE/mise-en-ligne"

command -v npm >/dev/null || { echo "npm est nécessaire pour compiler la boutique." >&2; exit 1; }

echo "1/4  Compilation de la boutique…"
cd "$RACINE/client"
[ -d node_modules ] || npm install --no-audit --no-fund
npm run build >/dev/null

echo "2/4  Assemblage de $SORTIE…"
rm -rf "$SORTIE"
mkdir -p "$SORTIE"
cp -r "$RACINE/client/dist/." "$SORTIE/"

echo "3/4  Copie de l'API…"
mkdir -p "$SORTIE/api"
cp -r "$RACINE/api/." "$SORTIE/api/"
# La configuration locale et les fichiers de travail ne partent jamais en ligne.
rm -f  "$SORTIE/api/config.php"
rm -rf "$SORTIE/api/storage"
# Les images téléversées en local restent en local ; les visuels de
# démonstration suivent, le temps d'avoir les vraies photos.
find "$SORTIE/api/uploads" -mindepth 1 -maxdepth 1 ! -name 'demo' ! -name '.htaccess' ! -name '.gitkeep' -exec rm -rf {} +

echo "4/4  Fichiers SQL et mode d'emploi…"
mkdir -p "$SORTIE/db"
cp "$RACINE/db/schema.sql" "$RACINE/db/seed.sql" "$SORTIE/db/"

cat > "$SORTIE/LISEZ-MOI.txt" <<'TXT'
DAROU MINANE — mise en ligne sur hébergement mutualisé (cPanel)

1. Base de données
   cPanel > MySQL Databases : créer la base et un utilisateur, lui donner
   tous les droits. Noter le nom exact (souvent préfixé : compte_darou).
   cPanel > phpMyAdmin > Importer : db/schema.sql, puis db/seed.sql si vous
   voulez les données de démonstration. NE PAS réimporter schema.sql ensuite,
   il efface les tables.

2. Fichiers
   Téléverser tout le contenu de ce dossier dans public_html/ :
   index.html, assets/, icones/, sw.js, manifest.webmanifest, .htaccess,
   api/ et db/. Attention : le .htaccess est un fichier caché, activez
   l'affichage des fichiers cachés dans le gestionnaire de fichiers.

3. Configuration
   Renommer api/config.example.php en api/config.php, puis y renseigner :
   - db : host, nom de la base, utilisateur, mot de passe
   - app.env : 'production'
   - app.origines_autorisees : [] (inutile quand tout est sur le même domaine)
   - boutique.whatsapp : le numéro du commerçant, sans + ni espaces

4. Droits d'écriture
   api/uploads doit être inscriptible (755 suffit en général sur cPanel).

5. Sécurité, à faire avant d'ouvrir la boutique
   - activer le certificat SSL (cPanel > SSL/TLS Status) et forcer HTTPS
   - se connecter au back-office et CHANGER les mots de passe de démonstration
   - supprimer db/ du serveur une fois l'import terminé

6. Vérification
   - https://votre-domaine/            la boutique s'affiche
   - https://votre-domaine/api/boutique renvoie du JSON
   - https://votre-domaine/admin       le back-office demande la connexion
TXT

TAILLE=$(du -sh "$SORTIE" | cut -f1)
echo
echo "Prêt : $SORTIE ($TAILLE)"
echo "Téléversez son contenu dans public_html/, puis suivez LISEZ-MOI.txt."
