-- =====================================================================
--  Darou Minane — migration : paiement mobile money (SasPay).
--
--  À exécuter une fois sur une base déjà en service, locale ou en ligne
--  (phpMyAdmin > votre base > onglet SQL > coller > Exécuter).
--  Rejouable : les IF NOT EXISTS de MariaDB ne recréent rien.
--  Aucune donnée existante n'est modifiée : les commandes déjà passées
--  restent « paiement à la livraison ».
-- =====================================================================

ALTER TABLE commandes
  ADD COLUMN IF NOT EXISTS mode_paiement ENUM('livraison','mobile_money') NOT NULL DEFAULT 'livraison'
      COMMENT 'choix du client : espèces au livreur, ou mobile money par SasPay' AFTER statut,
  ADD COLUMN IF NOT EXISTS paye_en_ligne_le DATETIME NULL
      COMMENT 'renseigné quand SasPay confirme le paiement' AFTER mode_paiement;

CREATE TABLE IF NOT EXISTS paiements (
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

-- Contrôle : doit afficher les deux nouvelles colonnes et 0 paiement.
SELECT
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'commandes'
      AND column_name IN ('mode_paiement', 'paye_en_ligne_le')) AS colonnes_ajoutees,
  (SELECT COUNT(*) FROM paiements) AS paiements;
