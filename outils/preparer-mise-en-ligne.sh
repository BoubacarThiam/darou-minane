#!/usr/bin/env bash
#
# Prépare le dossier à téléverser sur l'hébergement mutualisé.
#
# Usage :
#   ./outils/preparer-mise-en-ligne.sh              démo, sans les photos
#   ./outils/preparer-mise-en-ligne.sh --reel       le catalogue réel et ses photos
#   ./outils/preparer-mise-en-ligne.sh --reel --infinityfree
#
# --reel          exporte la base locale (catalogue, commandes, comptes) et
#                 emporte les photos de api/uploads.
# --infinityfree  adapte le mode d'emploi : le dossier s'appelle htdocs et
#                 non public_html, et la base se crée depuis leur panneau.
#
# Le résultat, mise-en-ligne/, contient exactement ce qui doit se retrouver
# dans public_html : la boutique compilée, l'API PHP et les fichiers SQL.
# Aucun outil n'est nécessaire sur le serveur (ni Node, ni Composer).

set -euo pipefail

REEL=0
INFINITYFREE=0
for argument in "$@"; do
  case "$argument" in
    --reel)          REEL=1 ;;
    --infinityfree)  INFINITYFREE=1 ;;
    *) echo "Option inconnue : $argument" >&2; exit 1 ;;
  esac
done

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
if [ "$REEL" -eq 1 ]; then
  echo "     photos du catalogue incluses ($(find "$SORTIE/api/uploads" -type f -name '*.webp' | wc -l) fichiers)"
else
  # Sans --reel, les images locales restent locales ; seuls les visuels de
  # démonstration suivent, le temps d'avoir les vraies photos.
  find "$SORTIE/api/uploads" -mindepth 1 -maxdepth 1 ! -name 'demo' ! -name '.htaccess' ! -name '.gitkeep' -exec rm -rf {} +
fi

echo "4/4  Fichiers SQL et mode d'emploi…"
mkdir -p "$SORTIE/db"
cp "$RACINE/db/schema.sql" "$RACINE/db/seed.sql" "$SORTIE/db/"

if [ "$REEL" -eq 1 ]; then
  SOCKET="$(php -r '$c = require $argv[1]; echo $c["db"]["socket"] ?? "";' "$RACINE/api/config.php")"
  NOM="$(php -r '$c = require $argv[1]; echo $c["db"]["nom"];' "$RACINE/api/config.php")"
  UTILISATEUR="$(php -r '$c = require $argv[1]; echo $c["db"]["utilisateur"];' "$RACINE/api/config.php")"
  if [ -n "$SOCKET" ] && [ -S "$SOCKET" ]; then
    # --skip-lock-tables : les hébergements mutualisés refusent LOCK TABLES
    # à l'import, et phpMyAdmin s'arrête à la première instruction refusée.
    mariadb-dump --socket="$SOCKET" -u "$UTILISATEUR" \
      --single-transaction --skip-lock-tables --no-tablespaces \
      --add-drop-table "$NOM" > "$SORTIE/db/catalogue.sql"
    echo "     catalogue exporté : $(grep -c 'INSERT INTO' "$SORTIE/db/catalogue.sql") instructions d'insertion"
  else
    echo "     ATTENTION : base locale injoignable, catalogue.sql non produit." >&2
    echo "     Lancez ./outils/base-locale.sh demarrer puis relancez." >&2
  fi
fi

if [ "$INFINITYFREE" -eq 1 ]; then
cat > "$SORTIE/LISEZ-MOI.txt" <<'TXT'
DAROU MINANE — mise en ligne sur InfinityFree

InfinityFree diffère d'un cPanel classique sur trois points : le dossier du
site s'appelle htdocs et non public_html, la base se crée depuis leur panneau
et s'importe par phpMyAdmin, et il n'y a aucun accès en ligne de commande.

1. BASE DE DONNÉES
   Panneau InfinityFree > MySQL Databases > Create Database.
   Notez les quatre valeurs affichées, elles ne ressemblent pas à celles
   d'un cPanel ordinaire :
     Hostname       sqlXXX.infinityfree.com   (PAS localhost)
     Database name  if0_XXXXXXX_darou
     Username       if0_XXXXXXX               (le même que le compte)
     Password       celui de votre compte InfinityFree

   Puis Panneau > phpMyAdmin > votre base > Importer :
     - db/catalogue.sql   si vous voulez partir avec le catalogue réel
       (58 produits, leurs photos, les comptes et l'historique)
     - ou db/schema.sql seul, pour une base vide
   N'importez jamais schema.sql par-dessus catalogue.sql : il efface tout.

2. FICHIERS
   Téléversez TOUT le contenu de ce dossier dans htdocs/ :
   index.html, assets/, icones/, sw.js, manifest.webmanifest, .htaccess,
   api/ et db/.
   Le .htaccess est un fichier caché : activez l'affichage des fichiers
   cachés dans le gestionnaire de fichiers, ou passez par FTP.

   FTP : hôte ftpupload.net, identifiant et mot de passe donnés par le
   panneau. Les photos sont nombreuses, comptez quelques minutes.

3. CONFIGURATION
   Renommez api/config.example.php en api/config.php et renseignez :
     'db' => [
       'host'         => 'sqlXXX.infinityfree.com',
       'socket'       => null,          // IMPORTANT : pas de socket ici
       'nom'          => 'if0_XXXXXXX_darou',
       'utilisateur'  => 'if0_XXXXXXX',
       'mot_de_passe' => '…',
     ],
     'app' => [
       'env'                  => 'production',
       'origines_autorisees'  => [],    // tout est sur le même domaine
     ],
   Vérifiez aussi boutique.whatsapp : le numéro du commerçant, sans + ni
   espaces.

4. VERSION DE PHP
   Panneau > PHP Config : choisissez PHP 8.0 ou plus récent. L'API utilise
   des expressions match() et des types nommés, PHP 7 les refuse.

5. DROITS D'ÉCRITURE
   api/uploads doit rester inscriptible pour que le back-office accepte de
   nouvelles photos. 755 convient.

6. AVANT D'OUVRIR LA BOUTIQUE
   - Panneau > SSL/TLS : activez le certificat gratuit, puis forcez HTTPS.
     Sans HTTPS, le service worker ne s'installe pas et la boutique perd son
     mode hors ligne.
   - Connectez-vous au back-office et CHANGEZ les deux mots de passe de
     démonstration. Ils sont publics, ils figurent dans le dépôt.
   - Supprimez le dossier db/ du serveur une fois l'import terminé : il
     contient tout votre catalogue en clair.

7. VÉRIFICATION
   https://votre-domaine/              la boutique s'affiche
   https://votre-domaine/api/boutique  renvoie du JSON
   https://votre-domaine/api/produits  renvoie vos produits
   https://votre-domaine/admin         demande le numéro et le mot de passe

8. CE QU'IL FAUT SAVOIR DE L'OFFRE GRATUITE
   - Les comptes inactifs sont suspendus ; connectez-vous au panneau de
     temps en temps.
   - Le quota d'accès est journalier : une boutique qui marche vraiment
     finira par le dépasser. Prévoyez un hébergement payant le jour venu.
   - Les sauvegardes ne sont pas garanties. Gardez une copie de
     db/catalogue.sql et du dossier api/uploads.
TXT
else
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
fi

TAILLE=$(du -sh "$SORTIE" | cut -f1)
echo
DOSSIER_CIBLE="public_html/"
[ "$INFINITYFREE" -eq 1 ] && DOSSIER_CIBLE="htdocs/"

echo "Prêt : $SORTIE ($TAILLE)"
echo "Téléversez son contenu dans $DOSSIER_CIBLE, puis suivez LISEZ-MOI.txt."
