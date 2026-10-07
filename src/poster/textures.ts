// Procedural print textures: crinkled paper and wheat-pasted posters.
// Everything is drawn on canvas so the site ships no image assets for them.

const CONDENSED = '"Anton", Impact, "Arial Narrow", sans-serif';
const MONO = '"Space Mono", ui-monospace, monospace';
const GROTESK = '"Helvetica Neue", "Inter Variable", Helvetica, Arial, sans-serif';

/** Deterministic PRNG so the paper looks the same on every visit. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

/**
 * Crinkled paper: fine fibre noise, soft blotches and creases. A crease is a
 * thin line with a light side and a dark side, like a fold catching light.
 */
export function drawPaper(ctx: CanvasRenderingContext2D, w: number, h: number, seed = 7, base = '#f6e9c6') {
  const rand = rng(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // Large soft light/shadow patches (the paper isn't flat).
  for (let i = 0; i < 18; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = (0.15 + rand() * 0.35) * Math.max(w, h);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const light = rand() > 0.5;
    g.addColorStop(0, light ? 'rgba(255,250,236,0.35)' : 'rgba(1,7,54,0.018)');
    g.addColorStop(1, 'rgba(1,7,54,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // Crumple: long fold lines across the sheet. Each fold shades one side
  // with a short gradient (a facet tilting away from the light) and leaves a
  // thin highlight on the ridge. Overlapping folds read as crinkled paper.
  const S = Math.max(w, h);
  const fold = (reach: number, alpha: number, len = S * 3, shade = true) => {
    const x = rand() * w;
    const y = rand() * h;
    const a = rand() * Math.PI;
    const nx = -Math.sin(a);
    const ny = Math.cos(a);
    const side = rand() > 0.5 ? 1 : -1;
    const g = ctx.createLinearGradient(x, y, x + nx * reach * side, y + ny * reach * side);
    g.addColorStop(0, `rgba(1,7,54,${alpha * 0.9})`);
    g.addColorStop(1, 'rgba(1,7,54,0)');
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    if (shade) {
      ctx.fillStyle = g;
      ctx.fillRect(-len / 2, side > 0 ? 0 : -reach, len, reach);
    }
    ctx.strokeStyle = `rgba(255,250,236,${alpha * 3.2})`;
    ctx.lineWidth = Math.max(1, S / 1400);
    ctx.beginPath();
    ctx.moveTo(-len / 2, -side);
    ctx.lineTo(len / 2, -side);
    ctx.stroke();
    ctx.restore();
  };
  // Navy shading stacks up quickly on cream, so keep each fold faint.
  for (let i = 0; i < 26; i++) fold(S * (0.04 + rand() * 0.14), 0.012 + rand() * 0.014);
  // Small wrinkles: short ridges only (shaded short folds read as stripes).
  for (let i = 0; i < 110; i++) fold(0, 0.025 + rand() * 0.04, S * (0.03 + rand() * 0.12), false);

  // Fibre noise, then a duotone pass: every pixel is re-inked by its
  // brightness between navy (#010736) and cream (#FCF1D0), so creases read
  // as darker cream instead of grey, like a two-colour print.
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const ref = 0.299 * 246 + 0.587 * 233 + 0.114 * 198;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 12;
    const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] + n) / ref;
    // Gentle curve: a deep crease only takes on ~15% navy.
    const t = Math.min(1, Math.max(0, 1 - (1 - l) * 0.4));
    const hi = Math.max(0, l - 1) * 3;
    d[i] = 1 + (252 - 1) * t + 3 * hi;
    d[i + 1] = 7 + (241 - 7) * t + 9 * hi;
    d[i + 2] = 54 + (208 - 54) * t + 28 * hi;
  }
  ctx.putImageData(img, 0, 0);
}

export function paperCanvas(w: number, h: number, seed = 7) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  drawPaper(c.getContext('2d')!, w, h, seed);
  return c;
}

function globe(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save();
  ctx.strokeStyle = '#010736';
  ctx.lineWidth = Math.max(1.5, r / 40);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  for (const k of [0.35, 0.72]) {
    ctx.beginPath();
    ctx.ellipse(x, y, r * k, r, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const k of [-0.55, 0, 0.55]) {
    const yy = y + k * r;
    const hw = Math.sqrt(1 - k * k) * r;
    ctx.beginPath();
    ctx.moveTo(x - hw, yy);
    ctx.lineTo(x + hw, yy);
    ctx.stroke();
  }
  ctx.restore();
}

export interface PosterSpec {
  words: string[];
  caption: string;
  vertical: string;
  seed: number;
  globe?: boolean;
  invert?: boolean;
}

/** A poster: paper, stacked condensed words, tiny annotations. */
export function posterCanvas(spec: PosterSpec, w = 1024, h = 1408) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  drawPaper(ctx, w, h, spec.seed);
  const rand = rng(spec.seed * 31);

  // Stacked words, each scaled to the poster width.
  const ink = spec.invert ? '#fcf1d0' : '#010736';
  if (spec.invert) {
    ctx.fillStyle = 'rgba(13,28,66,0.94)';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.fillStyle = ink;
  ctx.textBaseline = 'alphabetic';
  let y = h * 0.1;
  const lineH = (h * 0.78) / spec.words.length;
  for (const word of spec.words) {
    ctx.font = `400 ${lineH * 1.08}px ${CONDENSED}`;
    const m = ctx.measureText(word);
    // Generous side margins so the words never touch the face edges.
    const sx = (w * 0.82) / m.width;
    ctx.save();
    ctx.translate(w * 0.09, y + lineH * 0.92);
    ctx.scale(sx, 1);
    ctx.fillText(word, 0, 0);
    ctx.restore();
    y += lineH;
  }

  // Ink isn't perfect on crinkled paper: knock some of it back.
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.05 + rand() * 0.15})`;
    ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 3, 1 + rand() * 3);
  }
  ctx.globalCompositeOperation = 'source-over';
  // Re-apply the paper creases on top so the folds cut through the ink.
  ctx.globalAlpha = 0.35;
  ctx.globalCompositeOperation = 'overlay';
  const folds = paperCanvas(w / 2, h / 2, spec.seed + 3);
  ctx.drawImage(folds, 0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  // Annotations.
  ctx.fillStyle = ink;
  ctx.font = `400 ${w * 0.022}px ${MONO}`;
  ctx.fillText(spec.caption, w * 0.09, h * 0.06);
  ctx.save();
  ctx.translate(w * 0.955, h * 0.12);
  ctx.rotate(Math.PI / 2);
  ctx.font = `400 ${w * 0.02}px ${MONO}`;
  ctx.fillText(spec.vertical, 0, 0);
  ctx.restore();
  ctx.save();
  ctx.translate(w * 0.07, h * 0.965);
  ctx.rotate(-0.04);
  ctx.font = `400 ${w * 0.024}px ${GROTESK}`;
  ctx.fillText('NIKLAS WEBER — HEILBRONN — 2026', 0, 0);
  ctx.restore();
  if (spec.globe) globe(ctx, w * 0.82, h * 0.9, w * 0.06);
  return c;
}

export const POSTERS: PosterSpec[] = [
  { words: ['SYSTEMS', 'C / GO', 'POSIX'], caption: '[01] FROM_FIRST_PRINCIPLES', vertical: 'SHELLS · RAYTRACERS · RENDERERS', seed: 11, globe: true },
  { words: ['FROM', 'SCRATCH'], caption: '[02] NO_SHORTCUTS', vertical: 'FORK · EXECVE · DUP2 · WAITPID', seed: 23 },
  { words: ['BUILD', 'BREAK', 'REBUILD'], caption: '[03] 42_HEILBRONN', vertical: 'HOCHSCHULE HEILBRONN · SOFTWARE ENGINEERING', seed: 37, invert: true },
  { words: ['120', 'FPS'], caption: '[04] MEASURE_DONT_GUESS', vertical: 'SIMD · SSE · AVX · STRUCTURE OF ARRAYS', seed: 53, globe: true },
];
