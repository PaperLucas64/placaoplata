"""Procesa los assets originales (que NO van al repo) y deja versiones para el juego en apps/web/src/assets.

Uso:  python tools/assets/build.py "C:/Users/Blastoise/Documents/GitHub/00_ASSETS"
Necesita Pillow (pip install pillow).

- Fondos: recorte panorámico, filtro nocturno con luz de sodio y viñeta.
- Retratos: busto recortado desde el sprite de cuerpo entero (con transparencia).
- Siluetas: bustos negros para los rivales anónimos de La calle.
- Íconos: reducidos a 128 px; las armas en pixel art se agrandan sin suavizar.
Los créditos de cada pack están en docs/CREDITOS.md y en el juego (botón Créditos).
"""
import sys
from pathlib import Path
from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageOps

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else "C:/Users/Blastoise/Documents/GitHub/00_ASSETS")
OUT = Path(__file__).resolve().parents[2] / "apps/web/src/assets"
WATA = SRC / "01_Sprites/Pack_wataokiba"
NORA = {p.name: p for d in ["Noraneko_Background_Pack_1", "Noraneko_Backgrounds_Pack_2", "Noraneko_Backgrounds_Old"]
        for p in (SRC / d).glob("*.png")}
ICONS = SRC / "Cartoon_Icons_Pack"

# fondo -> (archivo original, tono)   tono: sodio (calle), azul (placa), rojo (plata)
BACKGROUNDS = {
    "calle":    ("City_Night.png", "sodio"),
    "laburos":  ("Street_Summer_Night.png", "sodio"),
    "bar":      ("Restaurant_B.png", "sodio"),
    "feria":    ("Old_Street.png", "sodio"),
    "gimnasio": ("Laundromat.png", "sodio"),
    "misiones": ("Train_Night_Rain.png", "sodio"),
    "guardia":  ("Bathroom.png", "frio"),
    "ranking":  ("Apartment_Exterior_Night.png", "sodio"),
    "placa":    ("City_Raining.png", "azul"),
    "plata":    ("Restaurant_A.png", "rojo"),
}
# retrato -> (carpeta del pack, variante de expresión)
PORTRAITS = {
    "marga":     ("josei_02_f", "a"),
    "rios":      ("josei_16_guide", "a"),
    "senora":    ("josei_04_akamafu", "a"),
    "gallego":   ("dansei_09_modscoat", "a"),
    "tito":      ("dansei_15_looptie", "a"),
    # avatares para elegir al crear el personaje
    "avatar_1":  ("dansei_03_kuropa", "a"),
    "avatar_2":  ("dansei_01_gakusei", "a"),
    "avatar_3":  ("josei_20_pw", "a"),
    "avatar_4":  ("josei_12_china", "a"),
}
FULLBODY = ["rios", "senora"]
SILHOUETTES = ["dansei_01_gakusei", "dansei_03_kuropa", "dansei_09_modscoat", "dansei_14_sussg", "dansei_15_looptie",
               "dansei_16_cardigan", "josei_04_akamafu", "josei_16_guide", "josei_20_pw", "dansei_06_gakuran"]
ICON_FILES = {
    "navaja": "PNGs/Knife.png", "escudo": "PNGs/Shield.png", "gimnasio": "PNGs/Dumbbell.png", "moneda": "PNGs/Coin.png",
    "plata": "Zxgly Icons/Cash Outline 256px.png", "auto": "PNGs/Car.png", "llave": "PNGs/Key.png",
    "bolso": "Zxgly Icons/Bag Outline 256px.png", "calavera": "PNGs/Skull.png",
}
# armas en pixel art (arlantr, "free to use any way you want"): se agrandan sin suavizar
GUNS_DIR = SRC / "free-guns-pixel-art/free-guns-pixel-art"
GUNS = {"pistola": "Pistol-3.png", "antimotin": "Shotgun-2.png", "recortada": "Shotgun-4.png", "fusil": "Assaut-rifle-1.png"}
TINTS = {"sodio": (255, 168, 80), "azul": (90, 140, 255), "rojo": (255, 90, 80), "frio": (170, 210, 220)}


def sprite(folder: str, variant: str = "") -> Image.Image:
    name = f"_{variant}.png" if variant else ".png"
    files = sorted((WATA / folder).rglob(f"*{name}")) if variant else \
        sorted(p for p in (WATA / folder).rglob("*.png") if "_" not in p.stem.split("_", 2)[-1] and len(p.stem.split("_")) == 2)
    if not files:
        raise FileNotFoundError(f"{folder} {variant}")
    return Image.open(files[0]).convert("RGBA")


def bust(im: Image.Image, size: int) -> Image.Image:
    """Recorta cabeza y hombros: desde lo más alto del sprite, un cuadrado del ancho de los hombros."""
    x0, y0, x1, y1 = im.getchannel("A").getbbox()
    w = x1 - x0
    side = int(w * 0.95)
    cx = (x0 + x1) // 2
    head = im.crop((x0, y0, x1, y0 + side // 2)).getchannel("A").getbbox()  # centrar en la cabeza
    if head:
        cx = x0 + (head[0] + head[2]) // 2
    box = (cx - side // 2, y0 - side // 20, cx + side // 2, y0 - side // 20 + side)
    canvas = Image.new("RGBA", (box[2] - box[0], box[3] - box[1]))
    canvas.paste(im.crop(box), (0, 0))
    return canvas.resize((size, size), Image.LANCZOS)


def grade(im: Image.Image, tint: str) -> Image.Image:
    """Noche de Bahía Gris: menos color, más oscuro, luz teñida y viñeta."""
    from PIL import ImageStat
    im = im.convert("RGB")
    im = ImageEnhance.Color(im).enhance(0.4)
    # cada foto arranca con distinto brillo: se lleva a un promedio parecido para que todas se lean igual
    mean = ImageStat.Stat(im.convert("L")).mean[0] or 1
    im = ImageEnhance.Brightness(im).enhance(min(3.0, 95 / mean))
    im = ImageEnhance.Contrast(im).enhance(1.1)
    color = Image.new("RGB", im.size, TINTS[tint])
    im = Image.blend(im, ImageChops.multiply(im, color), 0.55)
    w, h = im.size
    mask = Image.new("L", (w, h), 0)
    inner = Image.new("L", (int(w * 0.9), int(h * 0.85)), 255)
    mask.paste(inner, ((w - inner.width) // 2, (h - inner.height) // 2))
    mask = mask.filter(ImageFilter.GaussianBlur(min(w, h) // 5))
    return Image.composite(im, Image.new("RGB", im.size, (8, 9, 12)), mask)


def banner(im: Image.Image, w=1280, h=400) -> Image.Image:
    return ImageOps.fit(im, (w, h), Image.LANCZOS, centering=(0.5, 0.45))


def save(im: Image.Image, rel: str, quality=74):
    p = OUT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    im.save(p, "WEBP", quality=quality, method=6)
    print(f"{rel:32} {p.stat().st_size // 1024:4d} KB")


def main():
    for key, (file, tint) in BACKGROUNDS.items():
        save(grade(banner(Image.open(NORA[file])), tint), f"fondos/{key}.webp", 70)
    for key, (folder, variant) in PORTRAITS.items():
        im = sprite(folder, variant)
        save(bust(im, 256), f"retratos/{key}.webp", 82)
        if key in FULLBODY:
            im.thumbnail((400, 640), Image.LANCZOS)
            save(im, f"retratos/{key}_cuerpo.webp", 82)
    for i, folder in enumerate(SILHOUETTES, 1):
        save(bust(sprite(folder), 160), f"siluetas/{i:02d}.webp", 80)
    for key, rel in ICON_FILES.items():
        im = Image.open(ICONS / rel).convert("RGBA")
        im.thumbnail((128, 128), Image.LANCZOS)
        save(im, f"iconos/{key}.webp", 85)
    for key, file in GUNS.items():
        im = Image.open(GUNS_DIR / file).convert("RGBA")
        im = im.crop(im.getchannel("A").getbbox())
        k = max(1, 128 // max(im.size))
        im = im.resize((im.width * k, im.height * k), Image.NEAREST)
        p = OUT / f"iconos/arma_{key}.webp"
        im.save(p, "WEBP", lossless=True)
        print(f"iconos/arma_{key}.webp {p.stat().st_size // 1024:4d} KB")


if __name__ == "__main__":
    main()
