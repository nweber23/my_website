# Personal Portfolio

A minimal, editorial-inspired portfolio website built with vanilla HTML, CSS, and JavaScript.

## Overview

Clean and typography-focused personal website showcasing professional work and skills. Designed with an architecture-inspired aesthetic using serif and sans-serif font pairing.

**Live features:**
- Scroll-triggered section animations
- Real-time timezone display
- Respects reduced-motion preferences
- Fully responsive design

## Tech Stack

| Frontend | Deployment |
|----------|------------|
| HTML5 | Docker + Nginx |
| CSS3 | Let's Encrypt SSL |
| Vanilla JS | Docker Compose |

## Quick Start

**Local Development**
```bash
# Simply open in browser
open index.html
```

**Production Deployment**
```bash
# Configure environment
cp .env.example .env
# Edit .env with your domain and email

# Deploy with SSL
docker compose up -d
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed deployment instructions.

## Project Structure

```
├── index.html          # Main portfolio page
├── imprint.html        # Legal notice
├── styles.css          # Component-based styles
├── script.js           # Modular vanilla JS
├── assets/             # Project images
├── nginx/              # Server configuration
└── docker-compose.yml  # Container orchestration
```

## Design Principles

- **Minimalist** — Content-first with subtle decorative framing
- **Accessible** — Semantic HTML, ARIA labels, motion preferences
- **Performant** — No build tools, no frameworks, just clean code

## License

MIT
