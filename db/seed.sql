-- =====================================================================
--  DAROU MINANE — jeu de données de démonstration
--  À importer APRÈS db/schema.sql :
--    mysql -u USER -p BASE < db/seed.sql
--
--  Cohérence garantie par construction :
--    variantes.quantite = SOMME(mouvements_stock.quantite) de la variante
--    commandes.total    = SOMME(lignes_commande.total_ligne)
--  (vérifications SQL en bas de fichier)
--
--  Les produits marqués [DEMO] sont des exemples plausibles : remplacer
--  par le catalogue réel d'Abdou Karim (noms, prix, quantités).
--  Mots de passe de démo — À CHANGER avant mise en production :
--    Propriétaire : 221773385535 / darou2026
--    Employé      : 221770112233 / employe2026
-- =====================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

DELETE FROM mouvements_stock;
DELETE FROM lignes_commande;
DELETE FROM commandes;
DELETE FROM compteurs_commandes;
DELETE FROM images_produit;
DELETE FROM variantes;
DELETE FROM produits;
DELETE FROM categories;
DELETE FROM utilisateurs;

ALTER TABLE mouvements_stock AUTO_INCREMENT = 1;
ALTER TABLE lignes_commande  AUTO_INCREMENT = 1;
ALTER TABLE commandes        AUTO_INCREMENT = 1;
ALTER TABLE images_produit   AUTO_INCREMENT = 1;
ALTER TABLE variantes        AUTO_INCREMENT = 1;
ALTER TABLE produits         AUTO_INCREMENT = 1;
ALTER TABLE categories       AUTO_INCREMENT = 1;
ALTER TABLE utilisateurs     AUTO_INCREMENT = 1;

-- ---------------------------------------------------------------------
-- Utilisateurs
-- ---------------------------------------------------------------------
INSERT INTO utilisateurs (id, nom, telephone, mot_de_passe_hash, role, actif) VALUES
  (1, 'Abdou Karim', '221773385535', '$2y$10$1wNCyCqQ5g0HeXWaRn0CI.yiroCf6l6xInwGMFotYJm0IdmZfnYke', 'proprietaire', 1),
  (2, 'Fatou Ndiaye', '221770112233', '$2y$10$PKbvv9n25vD.DkszJZXIbuuzU.bVlTvnICe3/sd0Js6OAOFy.E/Z.', 'employe', 1);

-- ---------------------------------------------------------------------
-- Catégories
-- ---------------------------------------------------------------------
INSERT INTO categories (id, nom, slug, ordre) VALUES
  (1, 'Parfums',                     'parfums',       10),
  (2, 'Diffuseurs & humidificateurs','diffuseurs',    20),
  (3, 'Montres',                     'montres',       30),
  (4, 'Lunettes',                    'lunettes',      40);

-- ---------------------------------------------------------------------
-- Produits  [DEMO]
-- ---------------------------------------------------------------------
INSERT INTO produits (id, categorie_id, nom, slug, description, prix_base, mis_en_avant, actif) VALUES
  (1, 1, 'Parfum Oud Royal', 'parfum-oud-royal',
      'Oud boisé et ambré, tenue longue durée. Flacon vaporisateur.', 18000, 1, 1),
  (2, 1, 'Musc Tahara', 'musc-tahara',
      'Musc blanc doux, sans alcool. Le classique de la maison.', 8000, 0, 1),
  (3, 1, 'Coffret parfum Sultan', 'coffret-parfum-sultan',
      'Coffret cadeau de trois flacons 30 ml — oud, musc, ambre.', 35000, 0, 1),
  (4, 2, 'Diffuseur effet flamme', 'diffuseur-effet-flamme',
      'Brumisateur avec flamme lumineuse imitée, arrêt automatique à sec. Réservoir 200 ml.', 15000, 1, 1),
  (5, 2, 'Diffuseur bois vase', 'diffuseur-bois-vase',
      'Finition bois, silencieux, minuterie 1h/3h/6h. Réservoir 300 ml.', 12000, 0, 1),
  (6, 2, 'Humidificateur voiture', 'humidificateur-voiture',
      'Format porte-gobelet, alimentation USB, lumière d''ambiance.', 6500, 0, 1),
  (7, 2, 'Diffuseur volcan lumineux', 'diffuseur-volcan-lumineux',
      'Brume en jet vertical et éclairage volcan. Deux modes de débit.', 18000, 1, 1),
  (8, 3, 'Montre acier cadran bleu', 'montre-acier-cadran-bleu',
      'Boîtier acier 40 mm, cadran bleu, étanche 3 ATM.', 25000, 0, 1),
  (9, 3, 'Montre dorée automatique', 'montre-doree-automatique',
      'Mouvement automatique, fond squelette, bracelet doré.', 45000, 1, 1),
  (10, 4, 'Lunettes de soleil aviateur', 'lunettes-soleil-aviateur',
      'Monture métal, verres polarisés UV400, étui inclus.', 9000, 0, 1),
  (11, 4, 'Lunettes anti-lumière bleue', 'lunettes-anti-lumiere-bleue',
      'Verres filtrants pour écran, monture légère unisexe.', 7000, 0, 1);

-- ---------------------------------------------------------------------
-- Variantes  [DEMO] — porteuses du stock et du prix réel
-- ---------------------------------------------------------------------
INSERT INTO variantes (id, produit_id, sku, libelle, prix, prix_achat, quantite, seuil_alerte, position, actif) VALUES
  (1,  1, 'PRF-OUD-050',  '50 ml',            18000, 11000, 12, 3, 1, 1),
  (2,  1, 'PRF-OUD-100',  '100 ml',           28000, 17000,  8, 2, 2, 1),
  (3,  2, 'PRF-MUSC-030', '30 ml',             8000,  4500, 20, 5, 1, 1),
  (4,  3, 'PRF-SULT-COF', 'Coffret 3 flacons',35000, 22000,  5, 2, 1, 1),
  (5,  4, 'DIF-FLAM-NOI', 'Noir',             15000,  9000,  6, 2, 1, 1),
  (6,  4, 'DIF-FLAM-BLA', 'Blanc',            15000,  9000,  0, 2, 2, 1),
  (7,  5, 'DIF-BOIS-CLA', 'Bois clair',       12000,  7000,  5, 2, 1, 1),
  (8,  5, 'DIF-BOIS-FON', 'Bois foncé',       12000,  7000,  3, 3, 2, 1),
  (9,  6, 'HUM-VOIT-BLA', 'Blanc',             6500,  3500, 10, 3, 1, 1),
  (10, 6, 'HUM-VOIT-BLE', 'Bleu',              6500,  3500,  8, 3, 2, 1),
  (11, 6, 'HUM-VOIT-ROS', 'Rose',              6500,  3500,  7, 3, 3, 1),
  (12, 7, 'DIF-VOLC-STD', 'Standard',         18000, 11000,  4, 2, 1, 1),
  (13, 8, 'MON-ACIE-ARG', 'Bracelet argent',  25000, 15000,  3, 1, 1, 1),
  (14, 8, 'MON-ACIE-OR',  'Bracelet or',      27000, 16000,  2, 2, 2, 1),
  (15, 9, 'MON-AUTO-OR',  'Standard',         45000, 30000,  2, 2, 1, 1),
  (16, 10,'LUN-AVIA-NOI', 'Noir',              9000,  4500,  8, 3, 1, 1),
  (17, 10,'LUN-AVIA-DOR', 'Doré',              9000,  4500,  6, 3, 2, 1),
  (18, 11,'LUN-BLUE-STD', 'Standard',          7000,  3500, 12, 4, 1, 1);

-- ---------------------------------------------------------------------
-- Images  [DEMO] — placeholders SVG livrés dans api/uploads/demo/.
-- variante_id renseigné = la galerie bascule sur cette photo au choix
-- de la déclinaison. À remplacer par les vraies photos du commerçant.
-- ---------------------------------------------------------------------
INSERT INTO images_produit (produit_id, variante_id, chemin, position) VALUES
  (1,  NULL, 'demo/parfum-oud-royal.svg',        0),
  (2,  NULL, 'demo/musc-tahara.svg',             0),
  (3,  NULL, 'demo/coffret-sultan.svg',          0),
  (4,  NULL, 'demo/diffuseur-flamme.svg',        0),
  (4,  5,    'demo/diffuseur-flamme-noir.svg',   1),
  (4,  6,    'demo/diffuseur-flamme-blanc.svg',  2),
  (5,  NULL, 'demo/diffuseur-bois.svg',          0),
  (5,  7,    'demo/diffuseur-bois-clair.svg',    1),
  (5,  8,    'demo/diffuseur-bois-fonce.svg',    2),
  (6,  NULL, 'demo/humidificateur-voiture.svg',  0),
  (6,  9,    'demo/humidificateur-blanc.svg',    1),
  (6,  10,   'demo/humidificateur-bleu.svg',     2),
  (6,  11,   'demo/humidificateur-rose.svg',     3),
  (7,  NULL, 'demo/diffuseur-volcan.svg',        0),
  (8,  NULL, 'demo/montre-acier-bleu.svg',       0),
  (9,  NULL, 'demo/montre-doree.svg',            0),
  (10, NULL, 'demo/lunettes-aviateur.svg',       0),
  (11, NULL, 'demo/lunettes-anti-lumiere.svg',   0);

-- ---------------------------------------------------------------------
-- Commandes de démonstration
--   1 nouvelle en ligne (badge non lu)   4 livrée
--   2 vente comptoir du jour             5 vente comptoir d'hier
--   3 annulée (stock restitué)
-- ---------------------------------------------------------------------
INSERT INTO commandes (id, reference, canal, client_nom, client_telephone, client_quartier, client_note, statut, total, vue, utilisateur_id, created_at) VALUES
  (1, 'CMD-2026-0001', 'en_ligne', 'Awa Sow',        '221770001122', 'Quartier Pont — près de la pharmacie Diallo', 'Appeler avant de passer, après 17h.', 'nouvelle',  18500, 0, NULL, NOW() - INTERVAL 1 DAY),
  (2, 'CMD-2026-0002', 'comptoir', 'Client comptoir', NULL,          NULL, NULL,                                                                    'payee',     31000, 1, 2,    NOW()),
  (3, 'CMD-2026-0003', 'en_ligne', 'Modou Faye',     '221776543210', 'Dépôt — face station Total',                  'Client injoignable, commande annulée.', 'annulee',   30000, 1, NULL, NOW() - INTERVAL 3 DAY),
  (4, 'CMD-2026-0004', 'en_ligne', 'Ndèye Ba',       '221775558899', 'Saré Guilel — derrière l''école',              NULL,                                   'livree',    16000, 1, NULL, NOW() - INTERVAL 2 DAY),
  (5, 'CMD-2026-0005', 'comptoir', 'Client comptoir', NULL,          NULL, NULL,                                                                    'payee',     13000, 1, 1,    NOW() - INTERVAL 1 DAY);

INSERT INTO compteurs_commandes (annee, dernier_numero) VALUES (2026, 5);

INSERT INTO lignes_commande (commande_id, variante_id, libelle_fige, prix_unitaire, quantite) VALUES
  (1, 11, 'Humidificateur voiture — Rose',           6500, 1),
  (1, 7,  'Diffuseur bois vase — Bois clair',       12000, 1),
  (2, 5,  'Diffuseur effet flamme — Noir',          15000, 1),
  (2, 3,  'Musc Tahara — 30 ml',                     8000, 2),
  (3, 6,  'Diffuseur effet flamme — Blanc',         15000, 2),
  (4, 16, 'Lunettes de soleil aviateur — Noir',      9000, 1),
  (4, 18, 'Lunettes anti-lumière bleue — Standard',  7000, 1),
  (5, 9,  'Humidificateur voiture — Blanc',          6500, 2);

-- ---------------------------------------------------------------------
-- Mouvements de stock — l'historique complet qui produit variantes.quantite
-- 1) Arrivage initial du 20/08 (type entree)
-- ---------------------------------------------------------------------
INSERT INTO mouvements_stock (variante_id, type, quantite, quantite_apres, motif, commande_id, utilisateur_id, created_at) VALUES
  (1,  'entree', 12, 12, 'Arrivage Dakar 20/08', NULL, 1, NOW() - INTERVAL 16 DAY),
  (2,  'entree',  8,  8, 'Arrivage Dakar 20/08', NULL, 1, NOW() - INTERVAL 16 DAY),
  (3,  'entree', 22, 22, 'Arrivage Dakar 20/08', NULL, 1, NOW() - INTERVAL 16 DAY),
  (4,  'entree',  5,  5, 'Arrivage Dakar 20/08', NULL, 1, NOW() - INTERVAL 16 DAY),
  (5,  'entree',  7,  7, 'Arrivage Dakar 20/08', NULL, 1, NOW() - INTERVAL 16 DAY),
  (6,  'entree',  2,  2, 'Arrivage Dakar 20/08', NULL, 1, NOW() - INTERVAL 16 DAY),
  (7,  'entree',  6,  6, 'Arrivage Dakar 20/08', NULL, 1, NOW() - INTERVAL 16 DAY),
  (8,  'entree',  3,  3, 'Arrivage Dakar 20/08', NULL, 1, NOW() - INTERVAL 16 DAY),
  (9,  'entree', 12, 12, 'Arrivage Dakar 20/08', NULL, 1, NOW() - INTERVAL 16 DAY),
  (10, 'entree',  8,  8, 'Arrivage Dakar 20/08', NULL, 1, NOW() - INTERVAL 16 DAY),
  (11, 'entree',  8,  8, 'Arrivage Dakar 20/08', NULL, 1, NOW() - INTERVAL 16 DAY),
  (12, 'entree',  5,  5, 'Arrivage Dakar 20/08', NULL, 1, NOW() - INTERVAL 16 DAY),
  (13, 'entree',  3,  3, 'Arrivage Dakar 20/08', NULL, 1, NOW() - INTERVAL 16 DAY),
  (14, 'entree',  2,  2, 'Arrivage Dakar 20/08', NULL, 1, NOW() - INTERVAL 16 DAY),
  (15, 'entree',  2,  2, 'Arrivage Dakar 20/08', NULL, 1, NOW() - INTERVAL 16 DAY),
  (16, 'entree',  9,  9, 'Arrivage Dakar 20/08', NULL, 1, NOW() - INTERVAL 16 DAY),
  (17, 'entree',  6,  6, 'Arrivage Dakar 20/08', NULL, 1, NOW() - INTERVAL 16 DAY),
  (18, 'entree', 13, 13, 'Arrivage Dakar 20/08', NULL, 1, NOW() - INTERVAL 16 DAY);

-- 2) Inventaire : une pièce manquante sur le volcan
INSERT INTO mouvements_stock (variante_id, type, quantite, quantite_apres, motif, commande_id, utilisateur_id, created_at) VALUES
  (12, 'ajustement', -1, 4, 'Inventaire du 25/08 : 1 pièce introuvable', NULL, 1, NOW() - INTERVAL 11 DAY);

-- 3) Commande 3 (en ligne) puis son annulation : sortie puis retour
INSERT INTO mouvements_stock (variante_id, type, quantite, quantite_apres, motif, commande_id, utilisateur_id, created_at) VALUES
  (6, 'vente',  -2, 0, 'Commande CMD-2026-0003',              3, NULL, NOW() - INTERVAL 3 DAY),
  (6, 'retour',  2, 2, 'Annulation de la commande CMD-2026-0003', 3, 1, NOW() - INTERVAL 3 DAY + INTERVAL 4 HOUR);

-- 4) Casse constatée sur les deux diffuseurs flamme blancs restants
INSERT INTO mouvements_stock (variante_id, type, quantite, quantite_apres, motif, commande_id, utilisateur_id, created_at) VALUES
  (6, 'perte', -2, 0, 'Casse au transport, 2 pièces', NULL, 1, NOW() - INTERVAL 2 DAY);

-- 5) Ventes des commandes 4, 1, 5 puis la vente comptoir du jour (2)
INSERT INTO mouvements_stock (variante_id, type, quantite, quantite_apres, motif, commande_id, utilisateur_id, created_at) VALUES
  (16, 'vente', -1,  8, 'Commande CMD-2026-0004', 4, NULL, NOW() - INTERVAL 2 DAY),
  (18, 'vente', -1, 12, 'Commande CMD-2026-0004', 4, NULL, NOW() - INTERVAL 2 DAY),
  (11, 'vente', -1,  7, 'Commande CMD-2026-0001', 1, NULL, NOW() - INTERVAL 1 DAY),
  (7,  'vente', -1,  5, 'Commande CMD-2026-0001', 1, NULL, NOW() - INTERVAL 1 DAY),
  (9,  'vente', -2, 10, 'Vente comptoir CMD-2026-0005', 5, 1, NOW() - INTERVAL 1 DAY),
  (5,  'vente', -1,  6, 'Vente comptoir CMD-2026-0002', 2, 2, NOW()),
  (3,  'vente', -2, 20, 'Vente comptoir CMD-2026-0002', 2, 2, NOW());

-- =====================================================================
--  Vérifications (doivent renvoyer 0 ligne chacune)
-- =====================================================================
-- Stock incohérent avec son historique :
SELECT v.id, v.sku, v.quantite, COALESCE(SUM(m.quantite), 0) AS somme_mouvements
FROM variantes v
LEFT JOIN mouvements_stock m ON m.variante_id = v.id
GROUP BY v.id, v.sku, v.quantite
HAVING v.quantite <> COALESCE(SUM(m.quantite), 0);

-- Total de commande incohérent avec ses lignes :
SELECT c.id, c.reference, c.total, COALESCE(SUM(l.total_ligne), 0) AS somme_lignes
FROM commandes c
LEFT JOIN lignes_commande l ON l.commande_id = c.id
GROUP BY c.id, c.reference, c.total
HAVING c.total <> COALESCE(SUM(l.total_ligne), 0);
