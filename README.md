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
| 4 | Back-office : commandes + notifications | ✅ fait |
| 5 | Boutique publique + panier + tunnel de commande | ✅ fait |
| 6 | PWA, optimisations, déploiement cPanel | ✅ fait |

## Structure

```
client/          React (Vite) — back-office aujourd'hui, boutique publique à l'étape 5
api/             PHP 8 — index.php (routeur), controllers/, models/, lib/
api/uploads/     images produits (demo/ = visuels de démonstration)
db/schema.sql    schéma complet
db/seed.sql      jeu de données de démonstration
outils/          script de préparation de la mise en ligne
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

Voir **[Mise en ligne](#mise-en-ligne-cpanel)** plus bas : un script prépare le dossier
complet à téléverser.

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
| `POST` | `/commandes` | commande passée depuis la boutique, **sans compte ni session** |

```jsonc
// POST /commandes
{ "client_nom": "Aminata Ndour", "client_telephone": "77 654 32 10",
  "client_quartier": "Quartier Liberté, en face de la boulangerie",
  "client_note": "Livrer après 18h",
  "lignes": [{ "variante_id": 5, "quantite": 2 }] }
```

La réponse ne contient que ce qui regarde le client : référence, lignes au prix
figé, total, « livraison : à convenir » et le lien WhatsApp de suivi. Le canal
`en_ligne` et le statut `nouvelle` sont imposés par le serveur, le stock sort
dans la même transaction, et la commande arrive non lue dans le back-office
(badge + son). Dix commandes par heure et par appareil au maximum (`429`
au-delà) : la boutique est ouverte à tous, pas aux robots.

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

### Back-office — commandes, notifications et tableau de bord

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| `GET` | `/admin/commandes` | tous | liste filtrable : `statut`, `canal`, `q` (référence, nom, téléphone), `non_vues`, pagination |
| `GET` | `/admin/commandes/{id}` | tous | détail, liens WhatsApp et suites de statut possibles |
| `PUT` | `/admin/commandes/{id}/statut` | tous¹ | `{statut}` — change le statut |
| `GET` | `/admin/notifications` | tous | `{non_vues, commandes}` — badge et son du back-office |
| `GET` | `/admin/tableau-de-bord` | tous² | ventes du jour, commandes en attente, alertes de stock |

¹ annuler une commande déjà `payee` est réservé au propriétaire (c'est un
remboursement). ² l'employé reçoit les compteurs mais **aucun montant** :
chiffre d'affaires, panier moyen et valeur du stock sont calculés uniquement
pour le propriétaire.

Enchaînement des statuts (toute autre transition est refusée en `409`) :

```
nouvelle ──▶ confirmee ──▶ en_livraison ──▶ livree ──▶ payee
    └────────────┴───────────────┴────────────┴──────────┴──▶ annulee
```

Le passage à `annulee` **restitue le stock** : chaque ligne repasse en stock par
un mouvement `retour` rattaché à la commande, dans la même transaction que le
changement de statut. Une commande annulée est terminale.

Ouvrir une commande en ligne éteint son badge (`vue = 1`) : « non vue » veut dire
« personne ne l'a encore regardée ».

Chaque détail de commande porte deux liens `wa.me` prêts à l'emploi, construits
par `api/lib/Notifier.php` :

- `whatsapp.client` — le commerçant écrit au client (récapitulatif + livraison
  à convenir), `null` si la commande n'a pas de numéro ;
- `whatsapp.boutique` — le client écrit à la boutique (bouton « Suivre ma
  commande » de la boutique publique).

`Notifier` est le **seul** point de sortie vers l'extérieur : y brancher l'API
WhatsApp Business ou un SMS ne demande de toucher à aucun autre fichier.

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

## Application installable (PWA)

La boutique et le back-office s'installent sur l'écran d'accueil d'un téléphone
Android et fonctionnent en plein écran, sans barre d'adresse.

- `client/public/manifest.webmanifest` — nom, couleurs, icônes 192/512 et une
  icône *maskable*, plus trois raccourcis pour le commerçant (Vente rapide,
  Commandes, Stock) accessibles par appui long sur l'icône.
- `client/public/sw.js` — service worker écrit à la main (aucune dépendance de
  compilation) avec quatre caches versionnés :

| Ressource | Stratégie | Pourquoi |
|---|---|---|
| Page d'entrée | réseau d'abord, cache en secours | démarre même sans réseau |
| `assets/*.js`, `*.css` | cache d'abord | le nom porte une empreinte, le contenu ne change jamais |
| Photos produits | cache d'abord, 60 au plus | le plus lourd, et immuable |
| `GET /api/…` publics | réseau d'abord, cache en secours | catalogue consultable hors ligne |

**Jamais mis en cache** : `/api/admin/…`, `/api/auth/…` et toute requête qui
n'est pas un `GET`. Une donnée de gestion périmée serait pire que pas de donnée.

Un bandeau prévient quand le réseau tombe : le catalogue déjà chargé reste
consultable, l'envoi d'une commande attend le retour du réseau.

Les icônes actuelles sont un monogramme provisoire : à remplacer par le vrai
logo de l'enseigne (`client/public/icones/`, 192 px et 512 px, plus une version
*maskable* dont le motif tient dans les 80 % centraux).

## Poids et vitesse

Contrainte de départ : la boutique doit rester utilisable en 3G.

| Ce que télécharge un client à sa première visite | Compressé |
|---|---|
| React (paquet séparé, réutilisé d'une mise à jour à l'autre) | 53,6 Ko |
| Code de la boutique | 9,4 Ko |
| Feuille de style | 4,5 Ko |
| **Total** | **≈ 68 Ko** |

Le back-office (14,3 Ko) est un paquet à part, chargé seulement quand quelqu'un
ouvre `/admin`. Les visites suivantes ne retéléchargent rien tant que le code ne
change pas.

Côté serveur : photos converties en WebP à 1200 px, chargement différé,
compression `mod_deflate` et cache d'un an sur les fichiers versionnés. Les
réponses publiques de l'API sont mises en cache une minute (`stale-while-revalidate`
de cinq minutes) ; les réponses de gestion sont en `no-store`.

## Mise en ligne (cPanel)

```bash
./outils/preparer-mise-en-ligne.sh
```

Le script compile la boutique et assemble `mise-en-ligne/` : la boutique
compilée, l'API, les fichiers SQL et un `LISEZ-MOI.txt`. Il retire la
configuration locale (`api/config.php`), les fichiers de travail et les images
téléversées en développement. Rien à installer sur le serveur : ni Node, ni
Composer, ni Docker.

Ensuite, dans cPanel :

1. **Base** — *MySQL® Databases* : créer la base et un utilisateur avec tous les
   droits. *phpMyAdmin* → **Importer** → `db/schema.sql`, puis `db/seed.sql` pour
   les données de démonstration.
2. **Fichiers** — téléverser tout le contenu de `mise-en-ligne/` dans
   `public_html/`. Le `.htaccess` est un fichier caché : activer l'affichage des
   fichiers cachés dans le gestionnaire de fichiers.
3. **Configuration** — renommer `api/config.example.php` en `api/config.php` et y
   renseigner la base, `app.env => 'production'`, `origines_autorisees => []` et le
   numéro WhatsApp.
4. **Droits** — `api/uploads` doit être inscriptible (755).
5. **Avant d'ouvrir** — activer le certificat SSL et forcer HTTPS, **changer les
   mots de passe de démonstration** depuis le back-office, puis supprimer `db/`
   du serveur.

Le `.htaccess` de la racine (livré depuis `client/public/.htaccess`) envoie
toutes les routes React vers `index.html`, laisse `/api/` à l'API, active la
compression, met les fichiers versionnés en cache un an et laisse `index.html`,
`sw.js` et le manifeste en revalidation permanente — sans quoi une mise à jour
mettrait des jours à atteindre les téléphones.

**Mise à jour** : relancer le script et retéléverser `index.html`, `assets/` et
`api/`. Ne jamais réimporter `db/schema.sql` sur une base en service : il efface
les tables.

## Boutique publique

| Écran | Route | Contenu |
|---|---|---|
| Accueil | `/` | rayons, sélection de la boutique, derniers arrivages |
| Catalogue | `/catalogue` | tous les articles, mêmes filtres qu'une catégorie |
| Catégorie | `/c/:slug` | filtre de prix et tri, filtres conservés dans l'URL |
| Fiche produit | `/p/:slug` | galerie, choix de la variante, ajout au panier |
| Panier | `/panier` | quantités, retrait d'article, total |
| Commande | `/commande` | nom, téléphone, quartier/repère, note — **un seul écran** |
| Confirmation | `/commande/confirmation` | référence et bouton « Suivre ma commande sur WhatsApp » |

Aucun compte, aucun mot de passe : le client laisse son nom, son numéro et un
repère. Le **panier est conservé dans le navigateur** (`localStorage`) : fermer
l'onglet et revenir plus tard ne le vide pas.

Choisir une déclinaison met à jour le prix, la disponibilité et la photo. Une
variante épuisée reste **visible mais non commandable** : à la place du bouton
d'achat, un lien WhatsApp pré-rempli pour demander son retour.

Le prix affiché ne fait pas foi : le serveur refige le prix de chaque ligne au
moment de la commande, et refuse la commande entière si un article manque.

Partout : « Livraison : à convenir », jamais « gratuite », et « paiement à la
livraison ».

**Poids de la page.** Le back-office est chargé à la demande : un client qui
vient acheter un diffuseur télécharge 62 Ko compressés (application + boutique)
et jamais les 14 Ko des écrans de gestion. Les photos sont servies en WebP
1200 px, en chargement différé, avec un cache d'un an.

## Back-office React

`client/` contient l'application React (Vite) : la boutique publique sur `/`
et le back-office sur `/admin`, dans le même build mais deux paquets séparés.

| Écran | Route | Contenu |
|---|---|---|
| Connexion | `/admin/connexion` | téléphone + mot de passe, formats locaux acceptés (`77 338 55 35`) |
| Tableau de bord | `/admin` | ventes du jour, commandes à traiter, stock en alerte, dernières commandes |
| Vente rapide | `/admin/vente` | recherche d'articles, panier, encaissement |
| Commandes | `/admin/commandes` | liste filtrable (statut, canal, recherche, non ouvertes) |
| Détail commande | `/admin/commandes/:id` | client, articles, suivi de statut, annulation, lien WhatsApp |
| Produits | `/admin/produits` | liste filtrable (recherche, catégorie, état, stock en alerte) |
| Fiche produit | `/admin/produits/:id` | informations, variantes, photos ; `/admin/produits/nouveau` pour créer |
| Stock | `/admin/stock` | alertes, historique des mouvements, saisie d'entrée / perte / inventaire |
| Équipe | `/admin/equipe` | comptes employés — **propriétaire uniquement** |
| Mon compte | `/admin/compte` | identité, changement de mot de passe, déconnexion |

Ce que l'employé ne voit pas : les prix d'achat et les marges (filtrés par
l'API, pas seulement masqués), le chiffre d'affaires du jour, le panier moyen et
la valeur du stock, le bouton « Nouveau produit », les boutons de modification du
catalogue, les mouvements de perte et d'inventaire, et l'écran Équipe. La fiche
produit lui affiche un bandeau « consultation seule », et le bouton d'annulation
d'une commande déjà payée lui est désactivé, avec l'explication.

**Nouvelles commandes.** Le back-office interroge `/admin/notifications` toutes
les 30 secondes (et au retour sur l'onglet). Une commande en ligne jamais
ouverte pose une pastille dans la liste et un compteur sur l'onglet Commandes ;
son arrivée déclenche un message et **deux notes de synthèse** (Web Audio, aucun
fichier son à télécharger). Le signal ne se déclenche jamais au premier
chargement, seulement sur une vraie nouveauté, et l'ouverture de la commande
éteint le compteur.

Navigation : barre d'onglets en bas sur téléphone (cibles de 60 px, utilisables
au doigt) — Bord, Vente, Commandes, Produits, Stock ; colonne latérale à partir
de 900 px, qui ajoute Équipe. « Mon compte » est dans l'en-tête. Une seule famille typographique
(celle du système, aucun téléchargement de police), deux graisses. Les erreurs
du serveur s'affichent champ par champ.

### Organisation du code du front

```
client/src/api.js          client HTTP (jeton CSRF, erreurs typées)
client/src/auth.jsx        session React (utilisateur courant, rôle)
client/src/panier.jsx      panier du client, conservé en localStorage
client/src/boutique.jsx    identité de l'enseigne, servie par /boutique
client/src/notifications.jsx  badge et signal sonore des nouvelles commandes
client/src/statuts.js      libellés, couleurs et actions des statuts
client/src/format.js       FCFA, dates, libellés de mouvements
client/src/styles.css      feuille de style unique (jetons de couleur)
client/src/composants/     Champ, Modale, Toasts, Garde, Etats, Icones
client/src/boutique/       écrans publics (accueil, catégorie, fiche, panier…)
client/src/admin/          écrans du back-office ; Admin.jsx est le paquet
                           chargé à la demande
```

### Organisation du code de l'API

```
api/index.php          routeur + gestion centralisée des erreurs
api/config.php         configuration locale (jamais versionnée)
api/lib/               infrastructure : Router, Request, Response, Database,
                       Auth, Validator, Throttle, ImageService, Slug, Config,
                       Notifier
api/models/            domaine : Produit, Variante, ImageProduit, Categorie,
                       Utilisateur, Stock, Commande, TableauDeBord
api/controllers/       une classe par module, méthodes statiques
```

Convention : classes d'infrastructure en anglais, classes de domaine en français.
`models/Stock.php` est le **seul point d'écriture** de `variantes.quantite`.
