---
name: ui-darou-minane
description: Règles de design et d'animation de l'application Darou Minane (boutique en ligne + back-office). À utiliser dès qu'une interface React est créée ou modifiée dans ce projet — composant, écran, CSS, animation ou texte affiché à l'écran.
---

# Interface Darou Minane

## Deux interfaces, deux logiques

**Boutique publique** — clients qui achètent à l'œil (parfums, diffuseurs lumineux, montres, lunettes). Le produit occupe l'écran, l'interface s'efface. C'est le seul endroit où une intention esthétique est autorisée.

**Back-office** — Abdou Karim et ses employés, debout dans la boutique, sur téléphone, parfois en plein soleil. Dense, lisible, cibles tactiles larges, chargement immédiat. Aucune décoration, aucune animation non fonctionnelle.

Ne jamais appliquer l'habillage de la boutique au back-office.

## Tokens

Toute couleur, taille, espacement, rayon et durée vient de `client/src/tokens.css`. Aucune valeur hex ou px en dur dans un composant. Si une valeur manque, on l'ajoute au fichier de tokens, on ne l'écrit pas sur place.

Trois principes portés par ce fichier :

1. Le produit porte la couleur, l'interface n'en porte pas. Aucun rose derrière une photographie.
2. Le rose signe, il ne décore pas : la marque, l'action principale, l'état actif. Rien d'autre.
3. La boutique se regarde, le back-office se lit au soleil.

Deux échelles d'espacement, et c'est voulu : `--e-1` à `--e-8` pour la mise en page (base 4), `--c-serre` / `--c-petit` / `--c-moyen` / `--c-large` pour l'intérieur des contrôles, où la granularité de 2 px est mesurée (porter le rembourrage des pastilles de 14 à 16 px les fait passer à deux lignes à 360 px).

Rayons par hiérarchie : `--r-plein` (pastilles) · `--r-controle` (boutons, champs) · `--r-bloc` (cartes) · `--r-media` (photos). Élévation à deux niveaux seulement ; au repos, une carte porte un trait, jamais une ombre.

## Animation

L'animation répond à une action de l'utilisateur et montre ce qui a changé. Elle ne décore pas et n'attire pas l'attention sur elle-même.

- Uniquement `transform` et `opacity`.
- `--duree-retour` (160 ms) pour un retour d'action, `--duree-entree` (260 ms) pour une entrée. Jamais plus de 400 ms.
- Une seule courbe, `--courbe`.
- `prefers-reduced-motion: reduce` neutralise tout.
- Aucune animation dans l'écran de vente rapide.

Interdits : parallaxe, apparitions au scroll, survol animé sur toutes les cartes, compteurs animés, dégradés animés, effets en cascade.

## Contraintes terrain (Sénégal)

Connexion lente et téléphones d'entrée de gamme. Images en WebP, dimensionnées, `loading="lazy"` hors du premier écran (la première rangée reste en `eager` + `fetchpriority="high"`), ratios réservés pour éviter les sauts de mise en page. Squelettes plutôt que spinners. Tester à 360 px de large. Ne pas ajouter de dépendance front sans justifier son poids.

## Écriture

Français, ton simple, verbes actifs, casse de phrase. Nommer les choses comme l'utilisateur les comprend, pas comme le système les stocke. Le libellé d'une action reste le même dans tout le parcours : « Enregistrer le produit » → « Produit enregistré ». Une erreur dit ce qui s'est passé et quoi faire. Un écran vide invite à agir.

Montants en FCFA, sans décimales, séparateur d'espace : `12 500 FCFA`. Accorder les pluriels avec `pluriel()` de `format.js`, jamais de « (s) » entre parenthèses.

## Accessibilité minimale

Focus clavier visible, contrastes AA, libellés de formulaire réels (jamais un placeholder seul), clavier numérique sur les champs téléphone et quantité. Cibles tactiles à 44 px minimum, sauf liens à l'intérieur d'une phrase et fil d'Ariane.

## Avant de livrer un écran

Relire et retirer un élément décoratif de trop.
