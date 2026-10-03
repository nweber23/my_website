# Personal Portfolio — Down the Stack

Portfolio of Niklas Weber, built around an interactive model of one machine. The
hero is a stack of five layers — network, kernel & processes, main memory, cache
and an execution core — and each project lives on the layer it is really about.
Drag down through the stack and the camera descends; the layer you are on is in
focus while the ones above and below blur away.

## What the lab does

- **Five layers, five projects** — Transcendence on the network (WebSocket
  packets hopping between routers), minishell in the kernel (a shell forking
  `cat | grep | wc` inside a namespace), the ELO leaderboard in DRAM (rows
  refreshing), the Go renderer in the cache (64-byte lines flashing hit or miss)
  and miniRT in the core (SIMD lanes advancing in lockstep).
- **Real numbers** — latency per layer on a log scale, cycles at 4 GHz, the
  "if 1 ns were 1 s" intuition and the average memory access time
  `AMAT = t1 + (1−h)(t2 + (1−h)(t3 + (1−h)·t_mem))` for the chosen hit rate
  (`src/stack/layers.ts`).
- **Trace a request** — one packet travels down the bus through every layer and
  back, with a hop log; whether it touches DRAM depends on the cache hit rate.
- **Terminal** — `help`, `ls`, `cd ram`, `cat minirt`, `open elo`, `trace`,
  `hitrate 99`, `simd 4`, `whoami`.
- **Depth of field** — a bokeh pass focused on the current layer; the project
  card blurs while you are between layers.
- Keyboard: arrow keys move between layers, **1–5** jump to a layer, **T** traces
  a request.

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
├── index.html              # Home: stack lab + projects, writing, about, contact
├── writing.html            # Writing index
├── writing/                # Posts
├── imprint.html            # Legal notice
├── src/
│   ├── main.ts             # Home entry (clock, GitHub stats, lazy lab import)
│   ├── pages.ts            # Entry for writing/imprint pages
│   ├── stack/              # The machine-stack lab
│   │   ├── layers.ts       # Layers, latencies, AMAT and other formulas
│   │   ├── machine.ts      # Layer plates, machinery, bus, request packet
│   │   ├── models.ts       # Project miniatures
│   │   ├── terminal.ts     # The tiny shell that drives the lab
│   │   ├── textures.ts     # Canvas textures (labels, cards, terminal)
│   │   ├── subjects.ts     # Project data shown in the lab
│   │   └── stack.ts        # Renderer, camera, depth of field, UI binding
│   ├── shared/             # Clock, GitHub stats
│   └── styles/             # base, home and page styles
├── public/                 # Copied as-is: assets/, robots.txt, sitemap.xml, llms.txt
├── nginx/                  # Nginx server configuration
├── Dockerfile              # Build + serve image
└── docker-compose.yml      # Container orchestration
```

## License

[MIT](LICENSE)
