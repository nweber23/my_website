# Personal Portfolio — Poster System

Portfolio of Niklas Weber in an experimental print/poster brutalism: crinkled
paper, heavy navy type, tiny mono annotations and glossy pearl 3D letters.
Two inks, like a riso print: midnight navy (`#010736`, `#0D1C42`, `#22396F`)
on cream (`#FCF1D0`) — other colours only come from the project imagery.

## Motion system

Lenis inertial scrolling drives GSAP ScrollTrigger timelines; nearly everything
is tied to scroll progress.

1. **Loader** — midnight-navy screen, live `LOADING n%` counter over the real boot work
   (fonts, poster textures, WebGL), pill progress bar with a dashed core.
2. **Header** — fixed mono header with a dashed nav pill whose navy fill follows
   the section in view; turns light over the dark manifesto.
3. **Hero** — a Three.js billboard covered in procedurally drawn posters. The
   right face swings in, then the camera moves over the box until one poster
   fills the screen.
4. **Poster wall** — full-bleed crumpled paper, sparkle stars, skewed poster type.
5. **Giant text rows** — rows slide in alternating directions and flatten as
   they reach the centre; a self-drawing ellipse, spinning globes, flickering QR
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

Pearl letters (N, W, O, C, S) fly through the page, one per section.
`prefers-reduced-motion` removes pins, parallax and 3D motion and keeps simple
fades. 3D renders only while it is on screen.

## Technology Stack

| Layer | Technologies |
|-------|---|
| **Frontend** | HTML, CSS, TypeScript, three.js, GSAP + ScrollTrigger, Lenis |
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
├── src/
│   ├── main.ts             # Home entry: loader, Lenis, all ScrollTrigger timelines
│   ├── pages.ts            # Entry for writing/imprint pages
│   ├── poster/             # The poster system
│   │   ├── textures.ts     # Crumpled paper and poster canvases
│   │   ├── box.ts          # Hero billboard (Three.js)
│   │   ├── letters.ts      # Pearl 3D letters
│   │   └── dots.ts         # Footer dot matrix
│   ├── shared/             # Clock, GitHub stats
│   └── styles/             # base, home and page styles
├── public/                 # Copied as-is: assets/, robots.txt, sitemap.xml, llms.txt
├── nginx/                  # Nginx server configuration
├── Dockerfile              # Build + serve image
└── docker-compose.yml      # Container orchestration
```

## License

[MIT](LICENSE)
