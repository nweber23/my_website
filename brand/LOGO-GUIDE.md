# Niklas Weber logo guide

The mark is two letter tiles, a pink **N** and a blue **W**, tilted a few degrees in opposite directions with a thick outline and a hard shadow. They are the same tiles that drop in on the portfolio hero.

## Files

| File | Use |
|---|---|
| `nw-symbol.svg` | The master mark, full colour, for light backgrounds |
| `nw-symbol-small.svg` | Bolder cut for 24 to 64 px (nav bar, cards) |
| `nw-favicon.svg` | Browser-tab icon: both tiles, no gaps, heavy letters (also `web/favicon.*`) |
| `nw-favicon-micro.svg` | One big N tile for places that show it under about 20 px, like tiny avatars |
| `nw-symbol-mono.svg` | One colour (ink), outlined tiles with solid letters, for stamps, embroidery, fax-like prints |
| `nw-symbol-on-dark.svg` | Outline and shadow switch to paper colour so the mark holds on dark backgrounds |
| `nw-lockup-horizontal.svg` (+ `-on-dark`) | Mark plus "Niklas Weber", for headers and email signatures |
| `nw-lockup-stacked.svg` | Mark above the name, for README banners, social images, posters |
| `nw-wordmark.svg` | The name alone, outlined from Bricolage Grotesque ExtraBold |
| `nw-app-icon.svg`, `nw-app-icon-maskable.svg` | Mark on a yellow rounded tile, and the full-bleed version for Android |
| `web/` | `favicon.ico`, `favicon.svg`, PNG favicons, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `maskable-512.png` |
| `png/` | Transparent PNGs of the symbol and both lockups |
| `build_logo.py` | Regenerates every SVG above from one geometry |

All artwork is filled paths: no strokes, no live text, no filters.

## Colour

| Name | HEX | RGB | CMYK (screen estimate) | Role |
|---|---|---|---|---|
| Ink | `#16120f` | 22 18 15 | 0 18 32 91 | Outlines, shadows, N letter, wordmark |
| Pink | `#ff8fc2` | 255 143 194 | 0 44 24 0 | N tile |
| Blue | `#4f6bff` | 79 107 255 | 69 58 0 0 | W tile |
| Paper | `#fff4dc` | 255 244 220 | 0 4 14 0 | W letter, backgrounds |
| Yellow | `#ffd23f` | 255 210 63 | 0 18 75 0 | App icon background, site sheets |

CMYK values are quick conversions for screen work. For print, ask the printer for a proof and match Pantone there.

Measured contrast: ink on pink 8.8:1, paper on blue 3.9:1. Both letters are big graphic shapes, so they pass the 3:1 bar for large elements, but the W is the weaker one. Don't use the W tile for small text.

## Space and size

- **Clear space:** keep at least the width of one tile's outline times four, roughly 1/8 of the mark's width, free on every side.
- **Minimum sizes:** full-colour mark 40 px wide on screen (25 mm in print); `nw-symbol-small` down to 24 px; below that use `nw-favicon` (tab) or `nw-favicon-micro` (tiny avatars). Horizontal lockup: 120 px wide. Stacked lockup: 80 px wide.
- **Backgrounds:** use the full-colour mark on paper, white or yellow. Use `-on-dark` on anything darker than mid grey. Use `nw-symbol-mono` on photos or busy patterns.

## Do and don't

- Do keep the tilts and the shadow direction as drawn.
- Do use the stacked lockup when the space is narrower than about 4 to 1.
- Don't recolour the tiles, change the letters, straighten the tiles, add gradients, glows or extra shadows.
- Don't put the full-colour mark on pink or blue backgrounds, it disappears.
- Don't squash or stretch it, and don't retype the wordmark in another font.

## Known limits

- The presentation board's terminal mockup flattens the mark to white because it forces one colour. Use `nw-symbol-mono.svg` for one-colour uses instead.
- The wordmark is outlined without custom kerning. If it is ever set very large, check the gap between "k" and "l".
- Trademark clearance was not checked. If the name or mark will be used commercially, do a trademark search first.
- Bricolage Grotesque is open source (SIL OFL), so outlining it for a logo is allowed.
