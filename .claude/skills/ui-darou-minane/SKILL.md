---
name: ui-darou-minane
description: Règles de design et d'animation de l'application Darou Minane (boutique en ligne + back-office). À utiliser dès qu'une interface React est créée ou modifiée dans ce projet — composant, écran, CSS, animation ou texte affiché à l'écran.
---

# Interface Darou Minane

## Deux interfaces, un même soin

**Boutique publique** — clients qui achètent à l'œil (parfums orientaux noir et or, diffuseurs lumineux, montres, lunettes). Le produit occupe l'écran. C'est là que l'intention esthétique est la plus libre : une vitrine doit donner envie.

**Back-office** — Abdou Karim et ses employés, debout dans la boutique, sur téléphone, parfois en plein soleil. Dense, lisible, cibles tactiles larges, chargement immédiat.

Le propriétaire a demandé que le back-office soit lui aussi **habillé**, et non dépouillé : dégradés, pastilles d'icônes colorées, relief sous les cartes, colonne de navigation teintée. Cette décision remplace la règle précédente qui interdisait toute décoration côté gestion.

Habiller ne veut pas dire encombrer. Trois limites tiennent, parce qu'elles servent le commerçant et non le goût :

1. **Rien ne passe devant la lisibilité.** Contrastes AA, cibles de 44 px, texte jamais sous 14 px dans le back-office. Un dégradé qui fait tomber un libellé à 4,3:1 est un défaut, pas un style.
2. **Rien ne ralentit une vente.** Aucune animation dans l'écran de vente rapide : on y encaisse des dizaines de fois par jour.
3. **Rien qui coûte un écran de données.** Pas de police web, pas de bibliothèque d'animation ou de rendu 3D. Le décor se fait en CSS.

## Tokens

Toute couleur, taille, espacement, rayon, élévation et durée vient de `client/src/tokens.css`. Aucune valeur hex ou px en dur dans un composant. Si une valeur manque, on l'ajoute au fichier de tokens, on ne l'écrit pas sur place.

Deux échelles d'espacement, et c'est voulu : `--e-1` à `--e-8` pour la mise en page (base 4), `--c-serre` / `--c-petit` / `--c-moyen` / `--c-large` pour l'intérieur des contrôles, où la granularité de 2 px est mesurée (porter le rembourrage des pastilles de 14 à 16 px les fait passer à deux lignes à 360 px et déplace la grille de 98 px).

Rayons par hiérarchie : `--r-plein` (pastilles) · `--r-controle` (boutons, champs) · `--r-bloc` (cartes) · `--r-media` (photos). Le plus grand rayon va à la photo : c'est l'objet qu'on achète.

Élévation : `--relief-carte` au repos, `--relief-survol`, `--relief-flottant` pour ce qui flotte vraiment. Aplats décoratifs : `--degrade-mesure`, `--degrade-rose-doux`, `--fond-atelier`.

**Le rose ne passe jamais derrière une photographie.** Les photos reposent sur `--photo-fond`, un neutre à chroma nulle : un fond rosé teinte les flacons noir et or et trahit la découpe des photos à fond blanc.

## Animation

L'animation répond à une action et montre ce qui a changé.

- Uniquement `transform` et `opacity`.
- `--duree-retour` (160 ms) pour un retour d'action, `--duree-entree` (260 ms) pour une entrée. Jamais plus de 400 ms.
- Une seule courbe, `--courbe`.
- `prefers-reduced-motion: reduce` neutralise tout, et l'interface reste complète sans le mouvement.
- Aucune animation dans l'écran de vente rapide.

La boutique a droit à **un moment expressif** : la galerie en arc de la sélection (`GalerieCirculaire`), pilotée par le défilement natif. Un seul, bien fait.

Restent interdits : parallaxe, apparitions déclenchées au scroll, compteurs animés, dégradés animés, effets en cascade, et toute animation qui gêne la lecture d'un prix.

## Contraintes terrain (Sénégal)

Connexion lente et téléphones d'entrée de gamme. Images en WebP, dimensionnées, `loading="lazy"` hors du premier écran (la première rangée reste en `eager` + `fetchpriority="high"`), ratios réservés pour éviter les sauts de mise en page. Squelettes plutôt que spinners, aux dimensions réelles du contenu. Tester à 360 px de large.

**Aucune dépendance front sans justifier son poids.** Le projet tient sur React, React-DOM et React-Router. Un effet qui demande WebGL ou une bibliothèque d'animation se réécrit en CSS ou ne se fait pas.

## Écriture

Français, ton simple, verbes actifs, casse de phrase. Nommer les choses comme l'utilisateur les comprend, pas comme le système les stocke. Le libellé d'une action reste le même dans tout le parcours : « Enregistrer le produit » → « Produit enregistré ». Une erreur dit ce qui s'est passé et quoi faire. Un écran vide invite à agir.

Montants en FCFA, sans décimales, séparateur d'espace : `12 500 FCFA`. Accorder les pluriels avec `pluriel()` de `format.js`, jamais de « (s) » entre parenthèses.

## Accessibilité minimale

Focus clavier visible, contrastes AA, libellés de formulaire réels (jamais un placeholder seul), clavier numérique sur les champs téléphone et quantité. Cibles tactiles à 44 px minimum, sauf liens à l'intérieur d'une phrase et fil d'Ariane.

## Avant de livrer un écran

Mesurer plutôt que supposer : contraste, décalage de mise en page, cibles tactiles, débordement à 360 px. Puis relire et retirer un élément décoratif de trop.
