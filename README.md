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
| 2 | API PHP : routeur, PDO, auth, catalogue, stock, comptes | ✅ fait |
| 3 | Back-office React : login, produits, stock, vente rapide | ✅ fait |
| 4 | Back-office : commandes + notifications | à faire |
| 5 | Boutique publique + panier + tunnel de commande | à faire |
| 6 | PWA, optimisations, déploiement cPanel | à faire |

## Structure

```
client/          React (Vite) — back-office aujourd'hui, boutique publique à l'étape 5
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

## Lancer en développement

Deux serveurs, deux terminaux.

```bash
# 1. API PHP
cp api/config.example.php api/config.php     # puis renseigner la base de données
php -S 127.0.0.1:8000 -t api api/index.php   # API sur http://127.0.0.1:8000

# 2. Front React
cd client && npm install && npm run dev      # http://127.0.0.1:5173
```

Le front appelle toujours `/api/…` : en développement le proxy de Vite renvoie
vers le serveur PHP (voir `client/vite.config.js`), en production l'API vit
réellement dans `/api`. Le serveur intégré de PHP sert les images de
`api/uploads/` directement ; en production c'est `api/.htaccess` qui route
tout le reste vers `index.php`.

Build de production : `cd client && npm run build` → `client/dist/`.

## API

Conventions :

- JSON en entrée (`Content-Type: application/json`) et en sortie, UTF-8.
- Montants : entiers en FCFA. Dates : `AAAA-MM-JJ HH:MM:SS` (UTC).
- Listes paginées : `{ "donnees": [...], "pagination": { page, par_page, total, pages } }`.
- Erreurs : `{ "erreur": "message lisible", "champs": { "prix": "Minimum : 0." } }`
  avec `400` (requête malformée), `401` (non connecté), `403` (rôle ou CSRF),
  `404`, `405`, `409` (conflit métier : stock insuffisant, catégorie non vide),
  `422` (validation), `429` (trop de tentatives de connexion), `500`.
- Base d'URL : `/api` sur un hébergement cPanel classique.

### Authentification

Session PHP + cookie `httpOnly` `SameSite=Lax`. `POST /auth/connexion` renvoie un
**jeton CSRF** : le back-office doit le renvoyer dans l'en-tête `X-CSRF-Token`
sur **toute écriture authentifiée** (POST/PUT/DELETE), sinon `403`. Les routes
publiques n'en ont pas besoin. Le rôle est relu en base à chaque requête :
désactiver un employé le déconnecte immédiatement. Huit échecs de connexion
bloquent le couple numéro + IP pendant 15 minutes.

| Méthode | Route | Accès | Rôle |
|---|---|---|---|
| `POST` | `/auth/connexion` | public | `{telephone, mot_de_passe}` → utilisateur + `csrf_token` |
| `POST` | `/auth/deconnexion` | connecté | détruit la session |
| `GET` | `/auth/moi` | public | utilisateur courant (ou `null`) + jeton CSRF |
| `PUT` | `/auth/mot-de-passe` | connecté | `{mot_de_passe_actuel, nouveau_mot_de_passe}` |

### Boutique publique (sans compte)

Ces réponses ne contiennent **jamais** de prix d'achat, de marge, de SKU ni de
quantité chiffrée — seulement `en_stock: true|false`.

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/boutique` | nom, slogan, numéro WhatsApp, zone de livraison, devise |
| `GET` | `/categories` | catégories triées, avec le nombre de produits actifs |
| `GET` | `/produits` | catalogue paginé |
| `GET` | `/produits/{slug}` | fiche produit : variantes actives + galerie |

Paramètres de `/produits` : `q`, `categorie` (slug), `prix_min`, `prix_max`,
`mis_en_avant`, `tri` (`recent` par défaut, `nom`, `prix_asc`, `prix_desc`),
`page`, `par_page` (12 par défaut, 60 max). Le filtre prix garde les produits
ayant au moins une variante dans la fourchette.

### Back-office — catalogue

Lecture : propriétaire **et** employé. Écriture : **propriétaire seulement**.
L'employé reçoit les mêmes fiches sans `prix_achat` ni `marge`.

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| `GET` | `/admin/produits` | tous | filtres `q`, `categorie_id`, `actif`, `sous_seuil`, pagination |
| `POST` | `/admin/produits` | propriétaire | produit + ses variantes ; chaque `quantite` initiale crée un mouvement `entree` |
| `GET` | `/admin/produits/{id}` | tous | fiche complète (variantes actives et inactives, images) |
| `PUT` | `/admin/produits/{id}` | propriétaire | champs partiels ; le slug reste stable sauf s'il est envoyé |
| `DELETE` | `/admin/produits/{id}` | propriétaire | supprime si aucun historique, désactive sinon |
| `POST` | `/admin/produits/{id}/variantes` | propriétaire | ajoute une variante |
| `PUT` | `/admin/variantes/{id}` | propriétaire | libellé, prix, prix d'achat, seuil, position, SKU, actif |
| `DELETE` | `/admin/variantes/{id}` | propriétaire | supprime si aucun historique, désactive sinon |
| `POST` | `/admin/produits/{id}/images` | propriétaire | `multipart/form-data`, champ `images[]` (6 max), `variante_id` optionnel |
| `PUT` | `/admin/images/{id}` | propriétaire | `position`, `variante_id` (`null` = image générale) |
| `DELETE` | `/admin/images/{id}` | propriétaire | supprime la ligne et le fichier s'il n'est plus référencé |
| `POST` | `/admin/categories` | propriétaire | |
| `PUT` | `/admin/categories/{id}` | propriétaire | |
| `DELETE` | `/admin/categories/{id}` | propriétaire | refusée (`409`) si la catégorie contient des produits |

**`PUT /admin/variantes/{id}` refuse le champ `quantite`** : le stock ne se
modifie que par un mouvement.

Les images envoyées sont redressées (orientation EXIF des photos de téléphone),
redimensionnées à 1200 px de large maximum et réencodées en WebP (JPEG si
l'hébergeur n'a pas WebP). Le type réel du fichier est vérifié : un script
renommé en `.jpg` est rejeté, et `api/uploads/.htaccess` neutralise toute
exécution dans le dossier.

### Back-office — vente au comptoir

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| `GET` | `/admin/variantes` | tous | recherche d'articles pour la vente rapide (`q`, `disponible`, `limite`) — renvoie des **variantes**, avec leur stock et leur photo |
| `POST` | `/admin/commandes` | tous | vente comptoir : `{lignes: [{variante_id, quantite}], client_nom?}` |
| `GET` | `/admin/commandes/{id}` | tous | détail d'une commande |

Le canal `comptoir` est imposé par le serveur ; la commande naît au statut
`payee`, les lignes figent libellé et prix, et chaque ligne sort du stock par un
mouvement `vente` rattaché à la commande. Deux fois le même article dans le
panier donnent une seule ligne cumulée. Si un seul article manque, **rien**
n'est écrit : ni commande, ni numéro consommé.

### Back-office — stock

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| `GET` | `/admin/stock/mouvements` | tous | historique, filtres `variante_id`, `type`, pagination |
| `POST` | `/admin/stock/mouvements` | voir ci-dessous | enregistre un mouvement |
| `GET` | `/admin/stock/alertes` | tous | variantes actives dont `quantite <= seuil_alerte` |

```jsonc
// arrivage — autorisé aux employés
{ "variante_id": 7, "type": "entree", "quantite": 12, "motif": "Arrivage Dakar" }
// casse ou perte — propriétaire
{ "variante_id": 7, "type": "perte", "quantite": 2, "motif": "Casse au transport" }
// inventaire — propriétaire : on saisit le stock RÉELLEMENT compté
{ "variante_id": 7, "type": "ajustement", "quantite_reelle": 11, "motif": "Inventaire du soir" }
```

La variante est verrouillée le temps du calcul (`SELECT ... FOR UPDATE`) : deux
ventes simultanées ne peuvent pas vendre le même dernier article. Un mouvement
qui ferait passer le stock sous zéro est refusé en `409`, et un inventaire
conforme ne crée aucun mouvement (`modifie: false`).

### Back-office — comptes

Réservé au propriétaire. On ne supprime jamais un compte : on le désactive, pour
que l'historique reste attribué. Impossible de se désactiver soi-même ou de
retirer le dernier propriétaire actif (`409`).

| Méthode | Route |
|---|---|
| `GET` | `/admin/utilisateurs` |
| `POST` | `/admin/utilisateurs` |
| `PUT` | `/admin/utilisateurs/{id}` |
| `DELETE` | `/admin/utilisateurs/{id}` (désactivation) |

## Back-office React

`client/` contient l'application React (Vite). Aujourd'hui elle sert le
back-office ; la boutique publique s'ajoutera à l'étape 5 — d'ici là, `/`
redirige vers `/admin`.

| Écran | Route | Contenu |
|---|---|---|
| Connexion | `/admin/connexion` | téléphone + mot de passe, formats locaux acceptés (`77 338 55 35`) |
| Vente rapide | `/admin` | recherche d'articles, panier, encaissement — écran d'accueil |
| Produits | `/admin/produits` | liste filtrable (recherche, catégorie, état, stock en alerte) |
| Fiche produit | `/admin/produits/:id` | informations, variantes, photos ; `/admin/produits/nouveau` pour créer |
| Stock | `/admin/stock` | alertes, historique des mouvements, saisie d'entrée / perte / inventaire |
| Mon compte | `/admin/compte` | identité, changement de mot de passe, déconnexion |

Ce que l'employé ne voit pas : les prix d'achat et les marges (filtrés par
l'API, pas seulement masqués), le bouton « Nouveau produit », les boutons de
modification du catalogue, et les mouvements de perte et d'inventaire. La fiche
produit lui affiche un bandeau « consultation seule ».

Navigation : barre d'onglets en bas sur téléphone (cibles de 60 px, utilisables
au doigt), colonne latérale à partir de 900 px. Une seule famille typographique
(celle du système, aucun téléchargement de police), deux graisses. Les erreurs
du serveur s'affichent champ par champ.

### Organisation du code du front

```
client/src/api.js          client HTTP (jeton CSRF, erreurs typées)
client/src/auth.jsx        session React (utilisateur courant, rôle)
client/src/format.js       FCFA, dates, libellés de mouvements
client/src/styles.css      feuille de style unique (jetons de couleur)
client/src/composants/     Champ, Modale, Toasts, Garde, Etats, Icones
client/src/admin/          un fichier par écran
```

### Organisation du code de l'API

```
api/index.php          routeur + gestion centralisée des erreurs
api/config.php         configuration locale (jamais versionnée)
api/lib/               infrastructure : Router, Request, Response, Database,
                       Auth, Validator, Throttle, ImageService, Slug, Config
api/models/            domaine : Produit, Variante, ImageProduit, Categorie,
                       Utilisateur, Stock
api/controllers/       une classe par module, méthodes statiques
```

Convention : classes d'infrastructure en anglais, classes de domaine en français.
`models/Stock.php` est le **seul point d'écriture** de `variantes.quantite`.
