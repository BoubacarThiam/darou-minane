-- =====================================================================
--  DAROU MINANE — Groupe Business Communication 626
--  Schéma de base de données — MySQL 8 / MariaDB 10.4+
--  Devise : FCFA (XOF), sans décimales -> tous les montants sont des
--  entiers non signés. Fuseau : Sénégal (UTC+0).
--
--  ATTENTION : ce fichier supprime puis recrée les tables. Ne l'importer
--  que sur une base neuve ou une base de développement.
--  Import : mysql -u USER -p BASE < db/schema.sql
-- =====================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS paiements;
DROP TABLE IF EXISTS lignes_commande;
DROP TABLE IF EXISTS mouvements_stock;
DROP TABLE IF EXISTS commandes;
DROP TABLE IF EXISTS compteurs_commandes;
DROP TABLE IF EXISTS images_produit;
DROP TABLE IF EXISTS variantes;
DROP TABLE IF EXISTS produits;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS utilisateurs;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- utilisateurs : propriétaire + employés du back-office.
-- Aucun compte client : la boutique publique commande sans inscription.
-- ---------------------------------------------------------------------
CREATE TABLE utilisateurs (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nom               VARCHAR(100)  NOT NULL,
  telephone         VARCHAR(20)   NOT NULL COMMENT 'identifiant de connexion, format 221XXXXXXXXX',
  mot_de_passe_hash VARCHAR(255)  NOT NULL COMMENT 'password_hash() PHP',
  role              ENUM('proprietaire','employe') NOT NULL DEFAULT 'employe',
  actif             TINYINT(1)    NOT NULL DEFAULT 1,
  dernier_login     DATETIME      NULL,
  created_at        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_utilisateurs_telephone (telephone),
  KEY idx_utilisateurs_actif (actif)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- categories : Parfums, Diffuseurs & humidificateurs, Montres, Lunettes
-- ---------------------------------------------------------------------
CREATE TABLE categories (
  id    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nom   VARCHAR(80)  NOT NULL,
  slug  VARCHAR(80)  NOT NULL,
  ordre SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_categories_slug (slug),
  KEY idx_categories_ordre (ordre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- produits : l'objet vendu. NE PORTE PAS DE STOCK (voir variantes).
-- prix_base = prix affiché « à partir de » sur les listes.
-- ---------------------------------------------------------------------
CREATE TABLE produits (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  categorie_id  INT UNSIGNED NOT NULL,
  nom           VARCHAR(150) NOT NULL,
  slug          VARCHAR(170) NOT NULL,
  description   TEXT         NULL,
  prix_base     INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'FCFA, prix d''appel affiché en liste',
  mis_en_avant  TINYINT(1)   NOT NULL DEFAULT 0,
  actif         TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_produits_slug (slug),
  KEY idx_produits_categorie (categorie_id),
  KEY idx_produits_actif (actif, mis_en_avant),
  CONSTRAINT fk_produits_categorie FOREIGN KEY (categorie_id)
    REFERENCES categories (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- variantes : LE SEUL PORTEUR DE STOCK ET DE PRIX RÉEL.
-- Un produit sans déclinaison a une variante unique (libelle « Standard »).
-- quantite = valeur courante ; son historique est dans mouvements_stock.
-- prix_achat n'est jamais renvoyé aux employés (filtrage côté API).
-- ---------------------------------------------------------------------
CREATE TABLE variantes (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  produit_id   INT UNSIGNED NOT NULL,
  sku          VARCHAR(40)  NOT NULL,
  libelle      VARCHAR(80)  NOT NULL DEFAULT 'Standard' COMMENT 'ex. « Bois foncé », « 100 ml »',
  prix         INT UNSIGNED NOT NULL COMMENT 'FCFA TTC',
  prix_achat   INT UNSIGNED NULL COMMENT 'FCFA — propriétaire uniquement',
  quantite     INT          NOT NULL DEFAULT 0,
  seuil_alerte INT UNSIGNED NOT NULL DEFAULT 3,
  position     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  actif        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_variantes_sku (sku),
  KEY idx_variantes_produit (produit_id, position),
  KEY idx_variantes_quantite (quantite),
  CONSTRAINT fk_variantes_produit FOREIGN KEY (produit_id)
    REFERENCES produits (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT ck_variantes_quantite CHECK (quantite >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- images_produit : chemin relatif au dossier /api/uploads/.
-- variante_id NULL = image générale du produit ; renseigné = photo de la
-- déclinaison (la galerie bascule dessus quand on choisit la variante).
-- ---------------------------------------------------------------------
CREATE TABLE images_produit (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  produit_id  INT UNSIGNED NOT NULL,
  variante_id INT UNSIGNED NULL,
  chemin      VARCHAR(255) NOT NULL COMMENT 'relatif à /api/uploads/, ex. demo/volcan.svg',
  position    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_images_produit (produit_id, position),
  KEY idx_images_variante (variante_id),
  CONSTRAINT fk_images_produit FOREIGN KEY (produit_id)
    REFERENCES produits (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_images_variante FOREIGN KEY (variante_id)
    REFERENCES variantes (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- compteurs_commandes : numérotation CMD-AAAA-NNNN sans trou ni doublon.
-- Verrouillé par SELECT ... FOR UPDATE dans la transaction de commande.
-- ---------------------------------------------------------------------
CREATE TABLE compteurs_commandes (
  annee          SMALLINT UNSIGNED NOT NULL,
  dernier_numero INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (annee)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- commandes : en ligne (client) ou comptoir (vente rapide).
-- Le stock est décrémenté dès la création ; « annulee » le restitue.
-- vue = 0 tant que le back-office n'a pas ouvert la commande (badge).
-- ---------------------------------------------------------------------
CREATE TABLE commandes (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  reference        VARCHAR(20)  NOT NULL COMMENT 'ex. CMD-2026-0001',
  canal            ENUM('en_ligne','comptoir') NOT NULL DEFAULT 'en_ligne',
  client_nom       VARCHAR(120) NOT NULL,
  client_telephone VARCHAR(20)  NULL,
  client_quartier  VARCHAR(150) NULL COMMENT 'quartier / repère de livraison',
  client_note      TEXT         NULL,
  statut           ENUM('nouvelle','confirmee','en_livraison','livree','payee','annulee')
                   NOT NULL DEFAULT 'nouvelle',
  mode_paiement    ENUM('livraison','mobile_money') NOT NULL DEFAULT 'livraison'
                   COMMENT 'choix du client : espèces au livreur, ou mobile money par SasPay',
  paye_en_ligne_le DATETIME     NULL COMMENT 'renseigné quand SasPay confirme le paiement',
  total            INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'FCFA, hors livraison (à convenir)',
  vue              TINYINT(1)   NOT NULL DEFAULT 0,
  utilisateur_id   INT UNSIGNED NULL COMMENT 'vendeur (ventes comptoir)',
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_commandes_reference (reference),
  KEY idx_commandes_statut (statut, created_at),
  KEY idx_commandes_canal (canal, created_at),
  KEY idx_commandes_created (created_at),
  KEY idx_commandes_vue (vue),
  CONSTRAINT fk_commandes_utilisateur FOREIGN KEY (utilisateur_id)
    REFERENCES utilisateurs (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- lignes_commande : libellé et prix FIGÉS à la vente. Renommer ou
-- réévaluer un produit ne réécrit jamais l'historique des ventes.
-- ---------------------------------------------------------------------
CREATE TABLE lignes_commande (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  commande_id    INT UNSIGNED NOT NULL,
  variante_id    INT UNSIGNED NULL COMMENT 'NULL si la variante a été supprimée',
  libelle_fige   VARCHAR(200) NOT NULL COMMENT 'ex. « Diffuseur bois vase — Bois foncé »',
  prix_unitaire  INT UNSIGNED NOT NULL,
  quantite       INT UNSIGNED NOT NULL,
  total_ligne    INT UNSIGNED AS (prix_unitaire * quantite) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uk_lignes_commande_variante (commande_id, variante_id),
  KEY idx_lignes_commande (commande_id),
  KEY idx_lignes_variante (variante_id),
  CONSTRAINT fk_lignes_commande FOREIGN KEY (commande_id)
    REFERENCES commandes (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_lignes_variante FOREIGN KEY (variante_id)
    REFERENCES variantes (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT ck_lignes_quantite CHECK (quantite > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- paiements : une page de paiement SasPay (mobile money) par tentative.
-- Un client qui réessaie ouvre une nouvelle ligne ; l'ancienne session
-- est annulée chez SasPay pour qu'il ne puisse pas payer deux fois.
-- Le statut n'est JAMAIS écrit sur la foi du navigateur : seule une
-- relecture chez SasPay (Paiement::verifier) le fait passer à « paye ».
-- jeton = secret du lien de retour du client (?j=...), 128 bits.
-- ---------------------------------------------------------------------
CREATE TABLE paiements (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  commande_id       INT UNSIGNED NOT NULL,
  session_id        VARCHAR(64)  NOT NULL COMMENT 'session de checkout SasPay',
  transaction_id    VARCHAR(64)  NULL COMMENT 'transaction SasPay, connue une fois payée',
  reference_externe VARCHAR(64)  NULL COMMENT 'référence TXN-… visible chez SasPay',
  jeton             CHAR(32)     NOT NULL,
  checkout_url      VARCHAR(500) NOT NULL,
  email             VARCHAR(160) NULL COMMENT 'reçu SasPay, facultatif',
  montant           INT UNSIGNED NOT NULL COMMENT 'FCFA demandés (total de la commande)',
  montant_net       INT UNSIGNED NULL COMMENT 'FCFA reversés par SasPay',
  statut            ENUM('en_attente','paye','expire','annule') NOT NULL DEFAULT 'en_attente',
  verifie_le        DATETIME     NULL,
  paye_le           DATETIME     NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_paiements_session (session_id),
  UNIQUE KEY uk_paiements_jeton (jeton),
  KEY idx_paiements_commande (commande_id, id),
  KEY idx_paiements_statut (statut, created_at),
  CONSTRAINT fk_paiements_commande FOREIGN KEY (commande_id)
    REFERENCES commandes (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- mouvements_stock : L'HISTORIQUE QUI EXPLIQUE variantes.quantite.
-- Règle : aucun UPDATE de variantes.quantite sans ligne ici, dans la
-- même transaction SQL.
--   quantite      = delta signé (+ entrée/retour, − vente/perte, ± ajustement)
--   quantite_apres = stock résultant, photo pour l'audit
-- La FK RESTRICT protège l'historique : une variante mouvementée ne peut
-- pas être supprimée, elle se désactive (actif = 0).
-- ---------------------------------------------------------------------
CREATE TABLE mouvements_stock (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  variante_id    INT UNSIGNED NOT NULL,
  type           ENUM('entree','vente','retour','perte','ajustement') NOT NULL,
  quantite       INT NOT NULL COMMENT 'delta signé, jamais 0',
  quantite_apres INT NOT NULL,
  motif          VARCHAR(255) NULL,
  commande_id    INT UNSIGNED NULL,
  utilisateur_id INT UNSIGNED NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mouvements_variante (variante_id, created_at),
  KEY idx_mouvements_type (type, created_at),
  KEY idx_mouvements_commande (commande_id),
  KEY idx_mouvements_utilisateur (utilisateur_id),
  CONSTRAINT fk_mouvements_variante FOREIGN KEY (variante_id)
    REFERENCES variantes (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_mouvements_commande FOREIGN KEY (commande_id)
    REFERENCES commandes (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_mouvements_utilisateur FOREIGN KEY (utilisateur_id)
    REFERENCES utilisateurs (id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT ck_mouvements_quantite CHECK (quantite <> 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
