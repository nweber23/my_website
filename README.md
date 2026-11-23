<div align="center">

# nweber.me

**Portfolio of Niklas Weber — systems developer.**
An experimental print/poster-brutalist site: crinkled paper, heavy navy type, glossy pearl 3D letters.

[![Live](https://img.shields.io/badge/live-nweber.me-010736?style=flat-square)](https://nweber.me)
[![Deploy](https://img.shields.io/github/actions/workflow/status/nweber23/my_website/deploy.yml?branch=main&label=deploy&style=flat-square)](https://github.com/nweber23/my_website/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-22396f?style=flat-square)](LICENSE)

![TypeScript](https://img.shields.io/badge/TypeScript-010736?style=flat-square&logo=typescript&logoColor=fcf1d0)
![Vite](https://img.shields.io/badge/Vite-010736?style=flat-square&logo=vite&logoColor=fcf1d0)
![three.js](https://img.shields.io/badge/three.js-010736?style=flat-square&logo=threedotjs&logoColor=fcf1d0)
![GSAP](https://img.shields.io/badge/GSAP-010736?style=flat-square&logo=greensock&logoColor=fcf1d0)
![Docker](https://img.shields.io/badge/Docker-010736?style=flat-square&logo=docker&logoColor=fcf1d0)
![nginx](https://img.shields.io/badge/nginx-010736?style=flat-square&logo=nginx&logoColor=fcf1d0)

</div>

---

## Highlights

- **Scroll-driven motion.** Lenis inertial scrolling drives GSAP ScrollTrigger timelines; nearly everything is tied to scroll progress.
- **Procedural 3D.** A three.js hero billboard covered in generated posters, plus pearl 3D letters that rise through the page.
- **miniRT Studio.** A scene builder and live ray tracer in raw WebGL2 (see [below](#minirt-studio)).
- **Writing.** Technical posts on systems programming, graphics and distributed systems, with EN/DE switching.
- **Accessible.** `prefers-reduced-motion` removes pins, parallax and 3D motion in favour of simple fades; 3D only renders while on screen.
- **No framework.** Vanilla TypeScript, hand-written CSS, self-hosted fonts.

## Design

Two inks, like a riso print: midnight navy (`#010736`, `#0D1C42`, `#22396F`) on cream (`#FCF1D0`). Other colours only come from project imagery.

<details>
<summary><b>Motion system, section by section</b></summary>

1. **Loader** — navy screen with a live `BOOTING n%` counter over the real boot work (fonts, poster textures, WebGL); the sheet is then pulled up off the page.
2. **Header** — fixed mono header with a dashed nav pill whose fill follows the section in view.
3. **Hero** — a Three.js billboard of procedurally drawn posters; the camera moves over the box until one poster fills the screen.
4. **Poster wall** — full-bleed crumpled paper, sparkle stars, skewed poster type.
5. **Giant text rows** — rows slide in alternating directions and lean into the scroll (skew follows velocity).
6. **Values** — pinned horizontal track with ghost words at 1.3× speed and a rotating text-on-path portrait.
7. **Projects** — a pinned CSS 3D prism that steps one project per scroll segment.
8. **Index & field notes** — every case study as expandable rows.
9. **Manifesto** — navy duotone video with scanlines, RGB split and glitch jitter.
10. **Footer** — dot-matrix headline that pulses with scroll and ripples around the cursor.

</details>

## miniRT Studio

[`/minirt-studio.html`](https://nweber.me/minirt-studio.html) is a scene builder and live ray tracer for the 42 miniRT project, written in TypeScript and WebGL2. Spheres, planes, capped cylinders, cones and point lights are placed with the mouse and traced per pixel in a fragment shader (ambient light, Phong shading, hard shadows, optional mirrors and checkerboards).

| | |
|---|---|
| **Editing** | Select, move, resize and aim with on-canvas handles; numeric inspector; undo/redo, duplicate, snap. Orbit, pan and zoom, including touch. |
| **Files** | Import and export standard `.rt` files (`A`, `C`, `L`, `sp`, `pl`, `cy`, plus `co` for cones). Bad lines are skipped and listed, never fatal. |
| **Sharing** | Whole scene in the URL (deflate + base64url) with size caps on link and decompressed data. PNG export at 1920 px. |
| **Limits** | 24 spheres, 8 planes, 16 cylinders, 8 cones, 8 lights, 8 mirror bounces. |

<details>
<summary><b>Conventions, modules and caveats</b></summary>

- Left-handed like most miniRT builds (facing +Z, +X right, +Y up); colours are clamped linear values with no gamma; horizontal field of view; cylinder and cone positions are the middle of the axis.
- Mirrors, checkerboards, specular settings and bounce depth are studio-only and are not written to `.rt` files. Cones export as `co x,y,z axis diameter height r,g,b` with `x,y,z` at the base centre; check that your parser agrees.

| File | Role |
|------|------|
| `scene.ts` | Scene model, limits, validation of untrusted data |
| `rt.ts` | `.rt` parser and writer |
| `renderer.ts` | WebGL2 program and the ray tracing shader |
| `pick.ts`, `view.ts`, `math.ts` | CPU intersection for picking, camera projection, vector helpers |
| `viewport.ts` | Render loop, orbit/pan/zoom, handles, pointer input |
| `inspector.ts`, `main.ts` | Property panels, dialogs, toolbar, keyboard shortcuts |
| `store.ts`, `share.ts`, `presets.ts` | Undo history, link encoding and storage, starter scenes |

The CPU intersection code in `pick.ts` must stay in step with the shader, since selection uses it. Camera moves are a view change and stay out of undo.

</details>

## Tech stack

| Layer | Technologies |
|-------|--------------|
| Frontend | HTML, CSS, TypeScript, three.js, GSAP + ScrollTrigger, Lenis, raw WebGL2 |
| Build | Vite (multi-page), self-hosted fonts via Fontsource |
| Serving | nginx in a multi-stage Docker image, behind a host reverse proxy with Let's Encrypt TLS |
| CI/CD | GitHub Actions deploys to a VPS over SSH on every push to `main` |

## Getting started

Requires Node 20.19+ (22 recommended, see `.nvmrc`).

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/
```

## Deployment

Pushing to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which SSHes into the VPS and rebuilds the container. The deploy key is restricted server-side to a single forced command (`git pull && docker compose up -d --build`), and the workflow pins the server's host key fingerprint.

Required repository secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`.

To run it manually on any Docker host:

```bash
cp .env.example .env     # set DOMAIN_NAME
docker compose up -d --build
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for nginx, TLS and reverse-proxy details.

## Project structure

```
├── index.html            # Home: poster system, projects, writing, about, contact
├── writing.html          # Writing index
├── writing/              # Posts
├── projects/             # Project case-study pages
├── imprint.html          # Legal notice
├── minirt-studio.html    # miniRT Studio
├── src/
│   ├── main.ts           # Home entry: loader, Lenis, ScrollTrigger timelines
│   ├── pages.ts          # Entry for writing/imprint pages
│   ├── i18n/             # EN/DE dictionary
│   ├── poster/           # Paper textures, hero billboard, pearl letters, footer dots
│   ├── shared/           # Clock, GitHub stats
│   ├── studio/           # miniRT Studio
│   └── styles/           # base, home, pages, project, studio
├── public/               # Copied as-is: assets, robots.txt, sitemap.xml, llms.txt
├── nginx/                # nginx server configuration
├── Dockerfile            # Build + serve image
└── docker-compose.yml
```

## License

[MIT](LICENSE)
