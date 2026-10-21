"""Icônes de l'app tirées de public/logo.png : fond orange uni + marque blanche détourée.

python android-natif/outils/icone-app.py public/logo.png android-natif/app/src/main/res
Penser à reporter l'orange affiché dans res/values/themes.xml (icone_fond).
"""
import os
import sys
from PIL import Image, ImageDraw, ImageChops

source, res = sys.argv[1], sys.argv[2]
logo = Image.open(source).convert("RGB")

# Orange du fond : moyenne des bords, le logo étant un carré uni.
bord = [logo.getpixel((x, y)) for x in range(0, logo.width, 20) for y in (2, logo.height - 3)]
orange = tuple(round(sum(c[i] for c in bord) / len(bord)) for i in range(3))
print("orange", "#%02X%02X%02X" % orange)

# Détourage : l'opacité du blanc se lit sur le vert (73 sur le fond, 255 sur la marque), bords lissés gardés.
vert = logo.getchannel("G")
g0 = orange[1]
alpha = vert.point(lambda v: max(0, min(255, round((v - g0) * 255 / (255 - g0)))))
marque = Image.new("RGBA", logo.size, (255, 255, 255, 0))
marque.putalpha(alpha)
boite = alpha.point(lambda v: 255 if v > 24 else 0).getbbox()
marque = marque.crop(boite)
print("boite", boite, marque.size)


def poser(cote, diametre_utile):
    """La marque centrée sur une toile transparente, sa diagonale tenant dans le cercle utile."""
    w, h = marque.size
    echelle = diametre_utile / (w * w + h * h) ** 0.5
    m = marque.resize((round(w * echelle), round(h * echelle)), Image.LANCZOS)
    toile = Image.new("RGBA", (cote, cote), (0, 0, 0, 0))
    toile.alpha_composite(m, ((cote - m.width) // 2, (cote - m.height) // 2))
    return toile


DENSITES = {"ldpi": 0.75, "mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
for nom, f in DENSITES.items():
    d = os.path.join(res, "mipmap-" + nom)
    os.makedirs(d, exist_ok=True)
    for vieux in ("ic_launcher_background.png",):
        p = os.path.join(d, vieux)
        if os.path.exists(p):
            os.remove(p)
    # Couche avant adaptative : 108 dp, zone sûre de 66 dp de diamètre.
    cote = round(108 * f)
    poser(cote, 64 * f).save(os.path.join(d, "ic_launcher_foreground.png"), optimize=True)
    # Anciennes versions d'Android (avant 8.0) : 48 dp, carré aux coins arrondis et rond.
    c = round(48 * f)
    grand = c * 4
    for forme in ("carre", "rond"):
        masque = Image.new("L", (grand, grand), 0)
        dessin = ImageDraw.Draw(masque)
        if forme == "rond":
            dessin.ellipse((0, 0, grand - 1, grand - 1), fill=255)
        else:
            dessin.rounded_rectangle((0, 0, grand - 1, grand - 1), radius=grand // 6, fill=255)
        masque = masque.resize((c, c), Image.LANCZOS)
        fond = Image.new("RGBA", (c, c), orange + (255,))
        fond.alpha_composite(poser(c, c * (0.86 if forme == "rond" else 0.92)))
        fond.putalpha(ImageChops.multiply(fond.getchannel("A"), masque))
        fichier = "ic_launcher_round.png" if forme == "rond" else "ic_launcher.png"
        fond.save(os.path.join(d, fichier), optimize=True)

print("#%02X%02X%02X" % orange)
