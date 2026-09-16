-- =====================================================================
--  Darou Minane — retrait des données de démonstration.
--
--  À exécuter une fois, sur la base locale comme sur la base en ligne
--  (phpMyAdmin > votre base > onglet SQL > coller > Exécuter).
--
--  Ce script ne vise QUE les exemples fournis par db/seed.sql, identifiés
--  par leur référence ET leur nom de client, ou par leur numéro de
--  téléphone. Une vraie commande passée entre-temps, même numérotée
--  CMD-2026-0001, n'est pas touchée si le client n'est pas l'un des
--  clients fictifs. Il est rejouable : relancé, il ne trouve plus rien.
--
--  Le catalogue, les photos, le stock et le compte du propriétaire ne
--  sont pas concernés.
-- =====================================================================

START TRANSACTION;

-- --- 1. Les cinq commandes fictives ----------------------------------
--  Leurs lignes partent avec elles (ON DELETE CASCADE). Aucun mouvement
--  de stock ne s'y rattache plus : ceux du jeu de démonstration visaient
--  des produits de démonstration, déjà supprimés.
DELETE FROM commandes
 WHERE (reference = 'CMD-2026-0001' AND client_nom = 'Awa Sow')
    OR (reference = 'CMD-2026-0002' AND client_nom = 'Client comptoir' AND canal = 'comptoir')
    OR (reference = 'CMD-2026-0003' AND client_nom = 'Modou Faye')
    OR (reference = 'CMD-2026-0004' AND client_nom = 'Ndèye Ba')
    OR (reference = 'CMD-2026-0005' AND client_nom = 'Client comptoir' AND canal = 'comptoir');

-- --- 2. Le compte employé fictif -------------------------------------
--  Ses éventuelles traces (commandes saisies, mouvements) passent à NULL
--  grâce aux clés étrangères : l'historique reste, sans nom d'auteur.
DELETE FROM utilisateurs
 WHERE telephone = '221770112233' AND nom = 'Fatou Ndiaye' AND role = 'employe';

-- --- 3. Le compteur de références ------------------------------------
--  Recalé sur la plus haute référence qui reste, et non remis à zéro :
--  si une vraie commande existe déjà, la suivante ne doit pas reprendre
--  un numéro déjà attribué.
UPDATE compteurs_commandes c
   SET dernier_numero = COALESCE((
         SELECT MAX(CAST(SUBSTRING_INDEX(o.reference, '-', -1) AS UNSIGNED))
           FROM commandes o
          WHERE o.reference LIKE CONCAT('CMD-', c.annee, '-%')
       ), 0);

COMMIT;

-- --- Contrôle ---------------------------------------------------------
--  Doit afficher 0 commande fictive et 0 compte fictif.
SELECT
  (SELECT COUNT(*) FROM commandes
    WHERE client_nom IN ('Awa Sow', 'Modou Faye', 'Ndèye Ba')) AS commandes_fictives_restantes,
  (SELECT COUNT(*) FROM utilisateurs
    WHERE telephone = '221770112233') AS comptes_fictifs_restants,
  (SELECT COUNT(*) FROM commandes) AS commandes_au_total,
  (SELECT COUNT(*) FROM produits) AS produits;
