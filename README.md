# Personal Portfolio — Poster System

Portfolio of Niklas Weber in an experimental print/poster brutalism: crinkled
paper, heavy navy type, tiny mono annotations and glossy pearl 3D letters.
Two inks, like a riso print: midnight navy (`#010736`, `#0D1C42`, `#22396F`)
on cream (`#FCF1D0`) — other colours only come from the project imagery.

## Motion system

Lenis inertial scrolling drives GSAP ScrollTrigger timelines; nearly everything
is tied to scroll progress.

1. **Loader** — midnight-navy screen, live `BOOTING n%` counter over the real boot work
   (fonts, poster textures, WebGL), a pill bar that fills block by block; the
   navy sheet is then pulled up off the page.
2. **Header** — fixed mono header with a dashed nav pill whose navy fill follows
   the section in view; turns light over the dark manifesto.
3. **Hero** — a Three.js billboard covered in procedurally drawn posters. The
   right face swings in, then the camera moves over the box until one poster
   fills the screen.
4. **Poster wall** — full-bleed crumpled paper, sparkle stars, skewed poster type.
5. **Giant text rows** — rows slide in alternating directions and lean into the
   scroll (skew follows scroll velocity); a self-drawing ellipse, spinning globes, flickering QR
   blocks.
6. **Values** — pinned horizontal track with ghost words at 1.3× speed, an oval
   photo with rotating text on a path and one handwritten line.
7. **Projects** — a pinned CSS 3D prism that steps one project per scroll
   segment, with barcode and frame overlays.
8. **Index & field notes** — every case study in full, as expandable rows.
9. **Manifesto** — navy duotone video with scanlines, RGB split and glitch
   jitter, a cylinder of tag words, then a shrink into a small bleached portrait.
10. **Footer** — dot-matrix headline that pulses with scroll and ripples around
    the cursor.

Pearl letters (N, W, O, C, S) rise through the page, one per section, tumbling
in from below and out through the top. Blocks are revealed with a masked wipe,
and index rows fill with ink from the left on hover.
`prefers-reduced-motion` removes pins, parallax and 3D motion and keeps simple
fades. 3D renders only while it is on screen.

## miniRT Studio

`/minirt-studio.html` is a scene builder and live ray tracer for the 42 miniRT
project, written in TypeScript and WebGL2 with no framework. Spheres, planes,
capped cylinders, cones and point lights are placed with the mouse and traced
per pixel in a fragment shader (ambient light, Phong shading, hard shadows,
optional mirrors and checkerboards).

**Editing**
- Click a shape or light to select it. Arrows move it along an axis, the centre
  square moves it across the floor, square handles change radius and height, and
  the yellow diamond points a cylinder or cone axis or a plane normal.
- Drag empty space or a plane to orbit, right-drag or Shift-drag to pan, scroll
  to zoom. Pinch and two-finger pan on touch screens.
- Arrow keys and PageUp/PageDown nudge the selection, `Delete` removes it,
  `Ctrl+D` duplicates it, `Ctrl+Z` / `Ctrl+Shift+Z` undo and redo. A Snap toggle
  rounds positions to 0.25.
- A numeric inspector covers everything the handles do, plus colour, camera,
  ambient light and the studio-only surface settings.

**Files and sharing**
- Import and export standard `.rt` files (`A`, `C`, `L`, `sp`, `pl`, `cy`, and
  `co` for cones). Bad lines are skipped and listed, never fatal. You can also
  drop a file onto the view.
- Share links hold the whole scene in the URL (deflate + base64url), with size
  caps on both the link and the decompressed data. The last scene is kept in
  `localStorage`. PNG export renders 1920 px wide.
- Mirrors, checkerboards, specular settings and bounce depth are studio-only and
  are not written to `.rt` files. Cones are exported as `co x,y,z axis diameter
  height r,g,b` with `x,y,z` at the base centre; check that your parser agrees.

**Limits** (every object lives in shader uniforms): 24 spheres, 8 planes,
16 cylinders, 8 cones, 8 lights, 8 mirror bounces.

**Conventions**: left-handed like most miniRT builds (facing +Z, +X is right,
+Y is up), colours are clamped linear values with no gamma, and the field of
view is horizontal. Cylinder and cone positions are the middle of the axis.

| File | Role |
|------|------|
| `scene.ts` | Scene model, limits, validation of untrusted data |
| `rt.ts` | `.rt` parser and writer |
| `renderer.ts` | WebGL2 program and the ray tracing shader |
| `pick.ts`, `view.ts`, `math.ts` | CPU intersection for picking, camera projection, vector helpers |
| `viewport.ts` | Render loop, orbit/pan/zoom, handles, pointer input |
| `inspector.ts`, `main.ts` | Property panels, dialogs, toolbar, keyboard shortcuts |
| `store.ts`, `share.ts`, `presets.ts` | Undo history, link encoding and storage, starter scenes |

The CPU intersection code in `pick.ts` must stay in step with the shader, since
selection uses it. Camera moves are a view change and stay out of undo.

## Technology Stack

| Layer | Technologies |
|-------|---|
| **Frontend** | HTML, CSS, TypeScript, three.js, GSAP + ScrollTrigger, Lenis, raw WebGL2 (miniRT Studio) |
| **Build** | Vite (multi-page), self-hosted fonts via Fontsource |
| **Server** | Nginx with reverse proxy configuration |
| **Containerization** | Docker (multi-stage build) + Docker Compose |
| **Security** | Let's Encrypt SSL/TLS |

## Getting Started

### Local Development

```bash
npm install        # requires Node 20.19+ (22 recommended, see .nvmrc)
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/
```

### Production Deployment

```bash
cp .env.example .env
# Edit .env with your domain and email settings
docker compose up -d --build
```

The Dockerfile builds the site with Node and serves `dist/` from nginx. For
detailed deployment instructions, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Project Structure

```
├── index.html              # Home: poster system + projects, writing, about, contact
├── writing.html            # Writing index
├── writing/                # Posts
├── imprint.html            # Legal notice
├── minirt-studio.html      # miniRT Studio: in-browser scene editor and ray tracer
├── src/
│   ├── main.ts             # Home entry: loader, Lenis, all ScrollTrigger timelines
│   ├── pages.ts            # Entry for writing/imprint pages
│   ├── poster/             # The poster system
│   │   ├── textures.ts     # Crumpled paper and poster canvases
│   │   ├── box.ts          # Hero billboard (Three.js)
│   │   ├── letters.ts      # Pearl 3D letters
│   │   └── dots.ts         # Footer dot matrix
│   ├── shared/             # Clock, GitHub stats
│   ├── studio/             # miniRT Studio: WebGL2 shader, .rt parser, picking, handles, undo
│   └── styles/             # base, home and page styles
├── public/                 # Copied as-is: assets/, robots.txt, sitemap.xml, llms.txt
├── nginx/                  # Nginx server configuration
├── Dockerfile              # Build + serve image
└── docker-compose.yml      # Container orchestration
```

## License

[MIT](LICENSE)
