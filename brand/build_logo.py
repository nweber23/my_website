"""Builds the NW tiles logo set from code, so every file is generated from the same geometry.

Run from the project root:  python brand/build_logo.py
Needs: fontTools (pip install fonttools brotli). Font: Bricolage Grotesque from node_modules.
Everything is filled paths: no strokes, no live text.
"""
import math
import pathlib

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

OUT = pathlib.Path(__file__).parent
FONT = OUT.parent / 'node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2'

INK, PAPER, YELLOW, PINK, BLUE = '#16120f', '#fff4dc', '#ffd23f', '#ff8fc2', '#4f6bff'


def f(v):
    return f'{v:.2f}'.rstrip('0').rstrip('.')


def capsule(p, q, r):
    """A stroke segment with round ends, as a filled outline."""
    dx, dy = q[0] - p[0], q[1] - p[1]
    n = math.hypot(dx, dy)
    nx, ny = -dy / n * r, dx / n * r
    a, b = (p[0] + nx, p[1] + ny), (q[0] + nx, q[1] + ny)
    c, d = (q[0] - nx, q[1] - ny), (p[0] - nx, p[1] - ny)
    return (f'M{f(a[0])} {f(a[1])}L{f(b[0])} {f(b[1])}A{f(r)} {f(r)} 0 0 0 {f(c[0])} {f(c[1])}'
            f'L{f(d[0])} {f(d[1])}A{f(r)} {f(r)} 0 0 0 {f(a[0])} {f(a[1])}Z')


def line(points, r):
    return ''.join(capsule(points[i], points[i + 1], r) for i in range(len(points) - 1))


def rrect(x, y, w, h, r):
    return (f'M{f(x + r)} {f(y)}H{f(x + w - r)}A{f(r)} {f(r)} 0 0 1 {f(x + w)} {f(y + r)}V{f(y + h - r)}'
            f'A{f(r)} {f(r)} 0 0 1 {f(x + w - r)} {f(y + h)}H{f(x + r)}A{f(r)} {f(r)} 0 0 1 {f(x)} {f(y + h - r)}'
            f'V{f(y + r)}A{f(r)} {f(r)} 0 0 1 {f(x + r)} {f(y)}Z')


def tile(x, y, w, color, rot, edge, shadow, inset, letter, lr, outline=INK, shade=INK, ink=INK):
    """One letter tile: hard shadow, outline, colour face, letter (all filled paths)."""
    r = w * 0.27
    cx, cy = x + w / 2, y + w / 2
    parts = [
        f'<g transform="rotate({rot} {f(cx)} {f(cy)})">',
        f'<path d="{rrect(x + shadow, y + shadow, w, w, r)}" fill="{shade}"/>',
        f'<path d="{rrect(x, y, w, w, r)}" fill="{outline}"/>',
        f'<path d="{rrect(x + inset, y + inset, w - 2 * inset, w - 2 * inset, r - inset)}" fill="{color}"/>',
        f'<path d="{line(letter, lr)}" fill="{ink}"/>',
        '</g>',
    ]
    return ''.join(parts)


def symbol_body(small=False, outline=INK, shade=INK, ink_n=INK, ink_w=PAPER):
    if small:
        # Favicon cut: bigger letters, thicker outline, smaller shadow, nothing finer than 1/20 of the mark.
        a = tile(8, 80, 124, PINK, -6, 0, 9, 13, [(46, 166), (46, 112), (94, 166), (94, 112)], 11.5, outline, shade, ink_n)
        b = tile(124, 52, 124, BLUE, 6, 0, 9, 13, [(157, 86), (170, 146), (186, 104), (202, 146), (215, 86)], 11.5, outline, shade, ink_w)
    else:
        a = tile(11, 79, 122, PINK, -6, 0, 12, 10, [(48, 168), (48, 112), (96, 168), (96, 112)], 9, outline, shade, ink_n)
        b = tile(121, 55, 122, BLUE, 6, 0, 12, 10, [(150, 88), (166, 142), (182, 104), (198, 142), (214, 88)], 9, outline, shade, ink_w)
    return a + b


def micro_symbol():
    """16-32 px favicon: one big N tile. Two tiles turn to mush at 16 px."""
    return tile(34, 34, 176, PINK, -5, 0, 14, 16, [(96, 176), (96, 80), (160, 176), (160, 80)], 15)


def favicon_symbol():
    """Tab icon: both tiles at full width, no gaps, heavy letters, small shadow."""
    a = tile(4, 74, 118, PINK, -5, 0, 8, 10, [(44, 160), (44, 100), (82, 160), (82, 100)], 12)
    b = tile(126, 50, 118, BLUE, 5, 0, 8, 10, [(152, 84), (168, 140), (185, 100), (202, 140), (218, 84)], 12, ink=PAPER)
    return a + b


def svg(body, w=256, h=256, title='Niklas Weber logo'):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f(w)} {f(h)}" role="img" aria-label="{title}">'
            f'<title>{title}</title>{body}</svg>\n')


def symbol(small=False, **kw):
    # A 0.9 scale leaves room for the shadows inside the 256 box.
    return f'<g transform="translate(8.8 8) scale(0.9)">{symbol_body(small, **kw)}</g>'


def mono_symbol(color=INK):
    """One colour: outlined tiles with solid letters. No overlaps, no knock-outs, no shadow."""
    def tile_m(x, y, w, rot, letter):
        r, t = w * 0.27, 9
        cx, cy = x + w / 2, y + w / 2
        ring = rrect(x, y, w, w, r) + rrect(x + t, y + t, w - 2 * t, w - 2 * t, r - t)
        return (f'<g transform="rotate({rot} {f(cx)} {f(cy)})">'
                f'<path fill-rule="evenodd" d="{ring}" fill="{color}"/>'
                f'<path d="{line(letter, 8.5)}" fill="{color}"/></g>')
    body = (tile_m(10, 82, 110, -5, [(47, 160), (47, 110), (84, 160), (84, 110)]) +
            tile_m(136, 62, 110, 5, [(158, 92), (172, 136), (190, 104), (208, 136), (222, 92)]))
    return body


# ---- wordmark, outlined from Bricolage Grotesque ExtraBold -------------------------------------
_font = instancer.instantiateVariableFont(TTFont(FONT), {'wght': 800})
_gs, _cmap, _hmtx = _font.getGlyphSet(), _font.getBestCmap(), _font['hmtx']
UPM = _font['head'].unitsPerEm
CAP = _font['OS/2'].sCapHeight


def wordmark(text, cap_height, color=INK, tracking=-0.015):
    """Returns (path markup, width, height) with the baseline at y = cap_height."""
    s = cap_height / CAP
    x, d = 0.0, ''
    for ch in text:
        name = _cmap[ord(ch)]
        pen = SVGPathPen(_gs)
        _gs[name].draw(TransformPen(pen, (s, 0, 0, -s, x, cap_height)))
        d += pen.getCommands()
        x += _hmtx[name][0] * s + tracking * UPM * s
    x -= tracking * UPM * s
    desc = 0.24 * cap_height
    return f'<path d="{d}" fill="{color}"/>', x, cap_height + desc


def lockup_h(text_color=INK, **kw):
    mark = symbol(**kw)
    wm, w, _ = wordmark('Niklas Weber', 92, text_color)
    gap = 28
    return svg(f'{mark}<g transform="translate({256 + gap} {f(128 - 46 + 4)})">{wm}</g>', 256 + gap + w, 256)


def lockup_v(text_color=INK, **kw):
    mark = symbol(**kw)
    wm, w, h = wordmark('Niklas Weber', 70, text_color)
    W = max(256, w)
    return svg(f'<g transform="translate({f((W - 256) / 2)} 0)">{mark}</g><g transform="translate({f((W - w) / 2)} {256 + 22})">{wm}</g>', W, 256 + 22 + h)


def app_icon(size=256, scale=0.66, bg=YELLOW, round_=0.22):
    pad = size * (1 - scale) / 2
    return svg(f'<rect width="{size}" height="{size}" rx="{f(size * round_)}" fill="{bg}"/>'
               f'<g transform="translate({f(pad)} {f(pad)}) scale({f(scale)})">{symbol()}</g>', size, size, 'Niklas Weber app icon')


files = {
    'nw-symbol.svg': svg(symbol()),
    'nw-symbol-small.svg': svg(symbol(small=True)),
    'nw-favicon.svg': svg(favicon_symbol(), title='Niklas Weber favicon'),
    'nw-favicon-micro.svg': svg(micro_symbol(), title='Niklas Weber favicon'),
    'nw-symbol-mono.svg': svg(mono_symbol(INK)),
    'nw-symbol-on-dark.svg': svg(symbol(outline=PAPER, shade=PAPER)),
    'nw-lockup-horizontal.svg': lockup_h(),
    'nw-lockup-horizontal-on-dark.svg': lockup_h(PAPER, outline=PAPER, shade=PAPER),
    'nw-lockup-stacked.svg': lockup_v(),
    'nw-wordmark.svg': svg(wordmark('Niklas Weber', 92)[0], wordmark('Niklas Weber', 92)[1], wordmark('Niklas Weber', 92)[2], 'Niklas Weber'),
    'nw-app-icon.svg': app_icon(),
    'nw-app-icon-maskable.svg': app_icon(scale=0.56, round_=0),
}
for name, body in files.items():
    (OUT / name).write_text(body, encoding='utf-8')
    print('wrote', name)
