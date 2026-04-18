# Personal Portfolio

A minimal yet sophisticated portfolio website showcasing professional work and skills. Built with vanilla HTML, CSS, and JavaScript—no frameworks, no build tools, just clean, performant code.

## Overview

This is a production-grade portfolio website designed with principles of minimalism, accessibility, and performance. The design features an editorial aesthetic with carefully paired serif and sans-serif typography, complemented by smooth interactions and responsive layouts.

### Key Features

- **Scroll-triggered animations** — Smooth, GPU-accelerated section transitions
- **Real-time timezone display** — Dynamic location-aware content
- **Accessibility-first** — Full support for reduced-motion preferences, semantic HTML, and ARIA labels
- **Fully responsive** — Optimized for all device sizes and screen densities
- **SEO optimized** — Structured data, sitemap, and robots.txt for discoverability
- **High performance** — Minified assets, optimized image formats (WebP), no external dependencies

## Technology Stack

| Layer | Technologies |
|-------|---|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript (ES6+) |
| **Asset Optimization** | Minification, WebP image format |
| **Server** | Nginx with reverse proxy configuration |
| **Containerization** | Docker + Docker Compose |
| **Security** | Let's Encrypt SSL/TLS |

## Getting Started

### Local Development

```bash
# Open directly in your browser
open index.html
```

No dependencies, no build process—just open and start developing.

### Production Deployment

```bash
# Configure your environment
cp .env.example .env

# Edit .env with your domain and email settings
# Then deploy with Docker
docker compose up -d
```

For detailed deployment instructions, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Architecture & Design Philosophy

### Principles

**Minimalist Design** — Content takes center stage with intentional, restrained visual elements that enhance rather than distract.

**Accessibility First** — Built on semantic HTML with comprehensive ARIA labels, keyboard navigation, and respect for user motion preferences. Exceeds WCAG 2.1 standards.

**Performance Excellence** — Zero external dependencies, optimized asset delivery, and efficient JavaScript ensure fast load times and smooth interactions across all devices.

### Design Elements

- Editorial-inspired typography with carefully selected serif and sans-serif pairings
- Architecture-inspired aesthetic with clean lines and proportional spacing
- Optimized imagery available in multiple formats (PNG for maximum compatibility, WebP for modern browsers)
- Responsive grid system for consistent presentation across devices

## Project Structure

```
├── index.html              # Main portfolio page
├── imprint.html            # Legal notice
├── styles.css              # Component-based styles
├── styles.min.css          # Minified styles
├── script.js               # Modular vanilla JS
├── script.min.js           # Minified scripts
├── assets/                 # Project images (PNG and WebP formats)
├── nginx/                  # Nginx server configuration
├── nginx-reverse-proxy.conf # Reverse proxy configuration
├── Dockerfile              # Container image definition
├── docker-compose.yml      # Container orchestration
├── entrypoint.sh           # Docker entrypoint script
├── robots.txt              # Search engine crawling rules
├── sitemap.xml             # XML sitemap for SEO
├── scripts/                # Build and utility scripts
├── docs/                   # Documentation
│   └── DEPLOYMENT.md       # Deployment instructions
└── .env.example            # Environment variables template
```

## Documentation

- [**Deployment Guide**](docs/DEPLOYMENT.md) — Comprehensive instructions for production deployment with Docker

## License

[MIT](LICENSE)
