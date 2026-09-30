"""Genera el logotipo DiegoFinanzas (DIEGO / FINANZAS apilado) como curvas SVG.

Usa los contornos de Anton (SIL OFL) para que el logo no dependa de que la
fuente cargue. Requiere: pip install fonttools brotli
Salida: src/ui/brand/logoPaths.ts, scripts/logo-paths.json y public/favicon.svg
"""
import json
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

FONT = "node_modules/@fontsource/anton/files/anton-latin-400-normal.woff2"
TRACKING = -8  # unidades (de 1000) entre letras
LINE_GAP = 0.035  # separación entre líneas, en alturas de mayúscula
MAX_STRETCH = 1.9  # cuánto se ensancha DIEGO para igualar el ancho de FINANZAS

font = TTFont(FONT)
cmap = font.getBestCmap()
glyphs = font.getGlyphSet()
upm = font["head"].unitsPerEm
cap = font["OS/2"].sCapHeight
scale = 1000 / upm


def advances(text):
    return [font["hmtx"][cmap[ord(c)]][0] * scale for c in text]


def natural_width(text):
    adv = advances(text)
    return sum(adv) + TRACKING * (len(text) - 1)


def line_path(text, sx, extra, y_top):
    """Path de una línea: glifos ensanchados `sx` y separados `extra` unidades extra."""
    pen = SVGPathPen(glyphs)
    x = 0.0
    for c, adv in zip(text, advances(text)):
        name = cmap[ord(c)]
        # y de SVG crece hacia abajo: base = y_top + altura de mayúscula
        base = y_top + cap * scale
        tpen = TransformPen(pen, (scale * sx, 0, 0, -scale, x, base))
        glyphs[name].draw(tpen)
        x += (adv + TRACKING) * sx + extra
    return pen.getCommands()


top, bottom = "DIEGO", "FINANZAS"
width = natural_width(bottom)
sx = min(MAX_STRETCH, width / natural_width(top))
stretched = natural_width(top) * sx
extra = (width - stretched) / (len(top) - 1)
cap_h = cap * scale
height = cap_h * 2 + cap_h * LINE_GAP

d_top = line_path(top, sx, extra, 0)
d_bottom = line_path(bottom, 1.0, 0, cap_h * (1 + LINE_GAP))

view = f"0 0 {width:.1f} {height:.1f}"
ts = f"""// Generado por scripts/generate-logo.py (contornos de Anton, SIL OFL). No editar a mano.
export const LOGO_VIEWBOX = '{view}'
export const LOGO_ASPECT = {width / height:.4f}
export const LOGO_PATH = '{d_top} {d_bottom}'
"""
open("src/ui/brand/logoPaths.ts", "w").write(ts)
json.dump({"viewBox": view, "aspect": width / height, "d": d_top + " " + d_bottom}, open("scripts/logo-paths.json", "w"))
open("public/favicon.svg", "w").write(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#14392a"/>'
    f'<svg x="96" y="{256 - (320 / (width / height)) / 2:.1f}" width="320" height="{320 / (width / height):.1f}" viewBox="{view}"><path d="{d_top} {d_bottom}" fill="#f3f1ec"/></svg></svg>'
)
print("ok", view, "aspect", round(width / height, 3), "stretch", round(sx, 3))
