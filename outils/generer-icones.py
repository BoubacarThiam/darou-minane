#!/usr/bin/env python3
"""
Génère le logo et les icônes de l'application à partir du logo officiel.

    python3 outils/generer-icones.py [chemin/du/logo.jpeg]

Source par défaut : outils/logo-darou-minane.jpeg (sceau rose sur fond blanc).
Sortie : client/public/icones/

  logo-192.png, logo-512.png   icône « any » : le sceau seul, fond transparent
  logo-maskable-512.png        icône Android : le sceau dans la zone sûre
                               (cercle de 80 %), sur fond blanc, pour que le
                               lanceur puisse le rogner en rond ou en carré
                               sans jamais couper le texte de l'anneau
  logo-apple-180.png           iPhone : iOS ne gère pas la transparence
                               (fond noir), donc fond blanc
  logo-32.png                  favicon de l'onglet
  logo-128.webp, logo-256.webp le logo affiché dans les en-têtes et à la
                               connexion (srcset 1x à 3x)

Les noms portent « logo- » et non plus « icone- » : Chrome ne remplace
l'icône d'une application déjà installée que si l'adresse ou le contenu de
l'icône change, et un nouveau nom contourne aussi tous les caches.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

RACINE = Path(__file__).resolve().parent.parent
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else RACINE / 'outils' / 'logo-darou-minane.jpeg'
SORTIE = RACINE / 'client' / 'public' / 'icones'

MAITRE = 2048          # taille de travail, bien au-dessus de la plus grande sortie
ROGNAGE_BORD = 10      # px retirés au bord (sur 2048) : le liseré blanc du JPEG
ZONE_SURE = 0.80       # diamètre du sceau dans l'icône maskable (spécification W3C)
MARGE_APPLE = 0.90     # iOS arrondit les coins : le cercle tient dans le carré arrondi


def sceau(chemin: Path) -> Image.Image:
    """Le sceau détouré en cercle parfait, fond transparent, MAITRE × MAITRE."""
    image = Image.open(chemin).convert('RGB')
    pixels = np.asarray(image).astype(int)
    # Tout ce qui n'est pas le fond blanc appartient au sceau.
    encre = (255 * 3 - pixels.sum(axis=2)) > 60
    ys, xs = np.where(encre)
    cadre = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)

    # Le scan est très légèrement ovale (1523 × 1510) : le carré le rend rond.
    carre = image.crop(cadre).resize((MAITRE, MAITRE), Image.LANCZOS).convert('RGBA')

    # Masque circulaire suréchantillonné, pour un bord lisse sans escalier.
    grand = MAITRE * 4
    masque = Image.new('L', (grand, grand), 0)
    r = ROGNAGE_BORD * 4
    ImageDraw.Draw(masque).ellipse((r, r, grand - r, grand - r), fill=255)
    carre.putalpha(masque.resize((MAITRE, MAITRE), Image.LANCZOS))
    return carre


def reduit(image: Image.Image, cote: int) -> Image.Image:
    return image.resize((cote, cote), Image.LANCZOS)


def sur_fond_blanc(image: Image.Image, cote: int, proportion: float) -> Image.Image:
    fond = Image.new('RGBA', (cote, cote), (255, 255, 255, 255))
    diametre = round(cote * proportion)
    decalage = (cote - diametre) // 2
    fond.alpha_composite(reduit(image, diametre), (decalage, decalage))
    return fond


def png(image: Image.Image, nom: str) -> None:
    """PNG en palette de 256 couleurs : un sceau rose et blanc n'en use guère
    plus, l'écart moyen reste sous 1/255 et le fichier pèse 5 à 8 fois moins
    (le 512 passe de 215 à 27 Ko)."""
    image.quantize(256, method=Image.FASTOCTREE, dither=Image.NONE).save(SORTIE / nom, optimize=True)


def main() -> None:
    SORTIE.mkdir(parents=True, exist_ok=True)
    logo = sceau(SOURCE)

    for cote in (32, 192, 512):
        png(reduit(logo, cote), f'logo-{cote}.png')
    png(sur_fond_blanc(logo, 512, ZONE_SURE), 'logo-maskable-512.png')
    png(sur_fond_blanc(logo, 180, MARGE_APPLE), 'logo-apple-180.png')
    for cote in (128, 256):
        reduit(logo, cote).save(SORTIE / f'logo-{cote}.webp', quality=90, method=6)

    for fichier in sorted(SORTIE.glob('logo-*')):
        print(f'{fichier.relative_to(RACINE)}  {fichier.stat().st_size / 1024:.1f} Ko')


if __name__ == '__main__':
    main()
