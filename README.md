# Darou Minane — Groupe Business Communication 626

Boutique en ligne + gestion de stock pour **Abdou Karim**, commerçant à Tambacounda
(parfums, diffuseurs & humidificateurs, montres, lunettes).

- **Boutique publique** : catalogue, panier, commande sans compte, paiement à la livraison.
- **Back-office** : tableau de bord, vente rapide au comptoir, commandes, stock, produits, employés.

Devise **FCFA (XOF)**, sans décimales — tous les montants sont stockés en entiers.
Interface **française**. Cible d'hébergement : **mutualisé cPanel** (React compilé servi en
statique, API PHP dans `/api`, MySQL/MariaDB).

## État d'avancement

| Étape | Contenu | Statut |
|-------|---------|--------|
| 1 | `db/schema.sql` + `db/seed.sql` | ✅ fait |
| 2 | Squelette API PHP (routeur, PDO, auth, produits/variantes) | à faire |
| 3 | Back-office React : login, produits, stock, vente rapide | à faire |
| 4 | Back-office : commandes + notifications | à faire |
| 5 | Boutique publique + panier + tunnel de commande | à faire |
| 6 | PWA, optimisations, déploiement cPanel | à faire |

## Structure

```
client/          React (Vite) — boutique publique + back-office
api/             PHP 8 — index.php (routeur), controllers/, models/, lib/
api/uploads/     images produits (demo/ = visuels de démonstration)
db/schema.sql    schéma complet
db/seed.sql      jeu de données de démonstration
```

## Base de données

### Règle centrale

**Le stock vit sur la variante, jamais sur le produit.** `variantes.quantite` est la valeur
courante ; `mouvements_stock` est l'historique qui l'explique. Aucun `UPDATE` de
`variantes.quantite` sans ligne de mouvement correspondante, dans la même transaction SQL.

- `mouvements_stock.quantite` est un **delta signé** : `+` entrée / retour, `−` vente / perte,
  `±` ajustement d'inventaire. `quantite_apres` conserve le stock résultant (photo d'audit).
- Le stock est décrémenté **dès la création** de la commande ; le passage au statut `annulee`
  le restitue par un mouvement `retour`.
- `lignes_commande` fige le libellé et le prix : renommer ou réévaluer un produit ne réécrit
  jamais l'historique des ventes.
- Les prix d'achat (`variantes.prix_achat`) ne sont jamais renvoyés aux comptes `employe`
  (filtrage côté API, étape 2).

Garde-fous en base : `CHECK (quantite >= 0)` sur les variantes, mouvement à zéro interdit,
SKU unique, doublon de variante dans une même commande interdit, et suppression d'une variante
déjà mouvementée refusée (`ON DELETE RESTRICT`) — on **désactive** (`actif = 0`), on ne
supprime pas.

### Installation locale

```bash
mysql -u root -p -e "CREATE DATABASE darou_minane CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p darou_minane < db/schema.sql
mysql -u root -p darou_minane < db/seed.sql   # optionnel : données de démonstration
```

### Installation sur cPanel

1. *MySQL® Databases* → créer la base et un utilisateur, lui donner tous les droits.
2. *phpMyAdmin* → onglet **Importer** → `db/schema.sql`, puis `db/seed.sql` si l'on veut
   les données de démonstration.
3. Renseigner les identifiants dans `api/config.php` (étape 2).

`db/schema.sql` **supprime puis recrée** les tables : ne l'importer que sur une base neuve.

### Vérification

Les deux requêtes en fin de `db/seed.sql` doivent renvoyer **zéro ligne** :
stock cohérent avec son historique, totaux de commande cohérents avec leurs lignes.

### Comptes de démonstration — à changer avant la mise en production

| Rôle | Téléphone (identifiant) | Mot de passe |
|------|-------------------------|--------------|
| Propriétaire | `221773385535` | `darou2026` |
| Employé | `221770112233` | `employe2026` |

### Données de démonstration

11 produits / 18 variantes répartis sur les 4 catégories, 18 visuels SVG dans
`api/uploads/demo/`, 5 commandes (une nouvelle non lue, une vente comptoir du jour, une
annulée avec restitution du stock, une livrée, une vente comptoir de la veille) et
29 mouvements de stock cohérents.

> Les produits, prix et quantités sont **plausibles mais fictifs** : à remplacer par le
> catalogue réel du commerçant.

## Routes de l'API

À documenter à l'étape 2.
