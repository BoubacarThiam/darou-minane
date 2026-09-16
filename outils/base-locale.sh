#!/usr/bin/env bash
#
# Base de données locale de développement — durable.
#
#   ./outils/base-locale.sh demarrer   # démarre (et installe au besoin)
#   ./outils/base-locale.sh arreter
#   ./outils/base-locale.sh etat
#   ./outils/base-locale.sh sauvegarder
#
# Les données vivent dans ~/.local/share/darou-minane/db, et non dans un
# dossier temporaire : /tmp est nettoyé au redémarrage de la machine et
# entre les sessions d'outils, ce qui effaçait tout le catalogue.
#
# Le serveur est lancé détaché (setsid) : il survit à la fermeture du
# terminal qui l'a démarré.

set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE="$HOME/.local/share/darou-minane"
DONNEES="$BASE/db/data"
SOCKET="$BASE/db/s"
PID="$BASE/db/mariadb.pid"
JOURNAL="$BASE/db/erreur.log"

mkdir -p "$BASE/db"

# Lit une valeur de la section db de api/config.php sans l'afficher.
lire_config() {
  php -r '
    $c = require $argv[1];
    $d = $c["db"] ?? [];
    echo $d[$argv[2]] ?? "";
  ' "$RACINE/api/config.php" "$1"
}

tourne() {
  [ -S "$SOCKET" ] && /usr/bin/mariadb --socket="$SOCKET" -u root -e "SELECT 1" >/dev/null 2>&1
}

attendre() {
  for _ in $(seq 1 60); do
    tourne && return 0
    sleep 0.5
  done
  return 1
}

installer() {
  [ -d "$DONNEES" ] && return 0
  echo "Première installation dans $DONNEES…"
  mariadb-install-db --user="$(id -un)" --datadir="$DONNEES" \
    --auth-root-authentication-method=normal >"$BASE/db/installation.log" 2>&1
  echo "Installée."
}

demarrer() {
  if tourne; then
    echo "La base tourne déjà (socket : $SOCKET)."
    return 0
  fi
  installer
  setsid nohup /usr/sbin/mariadbd \
    --datadir="$DONNEES" \
    --socket="$SOCKET" \
    --skip-networking \
    --pid-file="$PID" \
    --log-error="$JOURNAL" >/dev/null 2>&1 &
  disown || true

  attendre || { echo "La base n'a pas démarré. Voir $JOURNAL"; exit 1; }

  local nom utilisateur motdepasse
  nom="$(lire_config nom)"
  utilisateur="$(lire_config utilisateur)"
  motdepasse="$(lire_config mot_de_passe)"

  # Base et compte applicatif, créés une seule fois. Le mot de passe passe
  # par un fichier temporaire à droits restreints, jamais par la ligne de
  # commande, qui serait visible dans la liste des processus.
  local sql; sql="$(mktemp)"; chmod 600 "$sql"
  php -r '
    $q = fn(string $v): string => "'"'"'" . str_replace(["\\\\", "'"'"'"], ["\\\\\\\\", "'"'"''"'"'"], $v) . "'"'"'";
    $nom = str_replace("`", "``", $argv[1]);
    printf("CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n", $nom);
    printf("CREATE USER IF NOT EXISTS %s@localhost IDENTIFIED BY %s;\n", $q($argv[2]), $q($argv[3]));
    printf("GRANT ALL PRIVILEGES ON `%s`.* TO %s@localhost;\n", $nom, $q($argv[2]));
    printf("FLUSH PRIVILEGES;\n");
  ' "$nom" "$utilisateur" "$motdepasse" > "$sql"
  /usr/bin/mariadb --socket="$SOCKET" -u root < "$sql"
  shred -u "$sql" 2>/dev/null || rm -f "$sql"

  echo "Base démarrée."
  echo "  socket   : $SOCKET"
  echo "  données  : $DONNEES"
  echo
  echo "Vérifiez que api/config.php pointe sur ce socket :"
  echo "  'socket' => '$SOCKET',"
}

arreter() {
  if ! tourne; then echo "La base ne tourne pas."; return 0; fi
  /usr/bin/mariadb-admin --socket="$SOCKET" -u root shutdown
  echo "Base arrêtée."
}

etat() {
  if tourne; then
    echo "En marche — socket $SOCKET"
    local nom; nom="$(lire_config nom)"
    /usr/bin/mariadb --socket="$SOCKET" -u root "$nom" -e "
      SELECT COUNT(*) AS produits FROM produits;
      SELECT COUNT(*) AS images FROM images_produit;
      SELECT COUNT(*) AS commandes FROM commandes;" 2>/dev/null \
      || echo "  (base '$nom' pas encore remplie)"
  else
    echo "Arrêtée. Lancez : ./outils/base-locale.sh demarrer"
  fi
}

sauvegarder() {
  tourne || { echo "La base ne tourne pas."; exit 1; }
  local nom fichier
  nom="$(lire_config nom)"
  fichier="$BASE/sauvegarde-$(date +%Y%m%d-%H%M%S).sql"
  /usr/bin/mariadb-dump --socket="$SOCKET" -u root --single-transaction --routines "$nom" > "$fichier"
  echo "Sauvegarde : $fichier"
}

case "${1:-etat}" in
  demarrer|start)      demarrer ;;
  arreter|stop)        arreter ;;
  etat|status)         etat ;;
  sauvegarder|dump)    sauvegarder ;;
  *) echo "Usage : $0 {demarrer|arreter|etat|sauvegarder}"; exit 1 ;;
esac
