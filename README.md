# Personal Portfolio — The Plane of Focus

Portfolio of Niklas Weber, built around an interactive lens lab. The hero is a
procedurally generated 50 mm lens on an optical bench: turn its focus ring and the
glass elements travel on their helicoid, moving the plane of focus through a
diorama where each project sits at its own distance.

## What the lab does

- **Real thin-lens optics** — focus distance, near/far limits, depth of field,
  hyperfocal distance, helicoid travel and blur-disc size are computed live for a
  50 mm lens on a 36 × 24 mm sensor (`src/lab/optics.ts`).
- **Procedural lens** — a six-element double-Gauss design with ED glass, a
  nine-blade iris, focus and aperture rings with printed scales, shown as a
  cutaway. Press **X** for the exploded view.
- **Light paths** — ray cones from the subject through the lens to the sensor,
  converging (or not) on the sensor plane; blur discs for every subject.
- **Sensor view** — a second camera at the lens's principal point, rendered with
  a custom bokeh shader that uses the same blur-disc formula as the readouts. The
  image also appears, upside down, on the 3D sensor.
- **Project card** — literally out of focus until you focus on its subject.
- Keyboard: arrow keys turn the ring, **1–5** focus on a project, **A** cycles the
  aperture, **X** exploded view, **S** sensor view.

All project content is also written out as regular HTML below the lab, so the
page stays readable without WebGL and for search engines.

## Technology Stack

| Layer | Technologies |
|-------|---|
| **Frontend** | HTML, CSS, TypeScript, three.js |
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
├── index.html              # Home: lens lab + projects, writing, about, contact
├── writing.html            # Writing index
├── writing/                # Posts
├── imprint.html            # Legal notice
├── src/
│   ├── main.ts             # Home entry (clock, GitHub stats, lazy lab import)
│   ├── pages.ts            # Entry for writing/imprint pages
│   ├── lab/                # The lens lab
│   │   ├── optics.ts       # Thin-lens formulas
│   │   ├── layout.ts       # Bench layout and log distance scale
│   │   ├── lens.ts         # Procedural lens model
│   │   ├── diorama.ts      # Project miniatures, bench, backdrop
│   │   ├── rays.ts         # Ray cones, blur discs, plane of focus, DoF zone
│   │   ├── sensorView.ts   # Sensor camera + bokeh shader
│   │   ├── textures.ts     # Canvas textures (scales, cards, terminal)
│   │   ├── subjects.ts     # Project data shown in the lab
│   │   └── lab.ts          # Renderer, interaction, UI binding
│   ├── shared/             # Clock, GitHub stats
│   └── styles/             # base, home and page styles
├── public/                 # Copied as-is: assets/, robots.txt, sitemap.xml, llms.txt
├── nginx/                  # Nginx server configuration
├── Dockerfile              # Build + serve image
└── docker-compose.yml      # Container orchestration
```

## License

[MIT](LICENSE)
