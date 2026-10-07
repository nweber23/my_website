// Dot-matrix footer headline: the word is sampled into a grid of dots that
// pulse with scroll and swell and darken around the cursor, with a soft
// ripple spreading from where the pointer moves.

interface Dot {
  x: number;
  y: number;
  on: number;
}

export class DotMatrix {
  private ctx: CanvasRenderingContext2D;
  private dots: Dot[] = [];
  private gap = 9;
  private mouse = { x: -9999, y: -9999 };
  private ripples: { x: number; y: number; t: number }[] = [];
  private lastRipple = 0;
  private w = 0;
  private h = 0;
  /** Scroll progress through the footer, 0..1. */
  progress = 0;
  visible = false;

  constructor(private canvas: HTMLCanvasElement, private word: string, private reduced: boolean) {
    this.ctx = canvas.getContext('2d')!;
    this.build();
    window.addEventListener('resize', () => this.build());
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
      const now = performance.now();
      if (now - this.lastRipple > 140) {
        this.ripples.push({ x: this.mouse.x, y: this.mouse.y, t: now });
        this.lastRipple = now;
        if (this.ripples.length > 6) this.ripples.shift();
      }
    });
    canvas.addEventListener('pointerleave', () => (this.mouse.x = this.mouse.y = -9999));
  }

  private build() {
    const dpr = Math.min(devicePixelRatio, 2);
    this.w = this.canvas.clientWidth;
    this.h = this.canvas.clientHeight;
    if (!this.w || !this.h) return;
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.gap = Math.max(6, Math.round(this.h / 30));

    // Rasterise the word offscreen, then sample it on the dot grid.
    const off = document.createElement('canvas');
    off.width = this.w;
    off.height = this.h;
    const o = off.getContext('2d')!;
    o.fillStyle = '#000';
    let size = this.h * 1.02;
    o.font = `400 ${size}px "Anton", Impact, sans-serif`;
    const tw = o.measureText(this.word).width;
    if (tw > this.w * 0.98) {
      size *= (this.w * 0.98) / tw;
      o.font = `400 ${size}px "Anton", Impact, sans-serif`;
    }
    o.textAlign = 'center';
    o.textBaseline = 'middle';
    o.fillText(this.word, this.w / 2, this.h / 2 + size * 0.04);
    const data = o.getImageData(0, 0, this.w, this.h).data;
    this.dots = [];
    for (let y = this.gap / 2; y < this.h; y += this.gap) {
      for (let x = this.gap / 2; x < this.w; x += this.gap) {
        const a = data[(Math.floor(y) * this.w + Math.floor(x)) * 4 + 3];
        this.dots.push({ x, y, on: a > 128 ? 1 : 0 });
      }
    }
    this.draw(performance.now());
  }

  draw(now: number) {
    const { ctx, gap } = this;
    ctx.clearRect(0, 0, this.w, this.h);
    const pulse = this.reduced ? 1 : 0.8 + 0.2 * Math.sin(this.progress * Math.PI * 4);
    const base = gap * 0.36;
    for (const d of this.dots) {
      const dx = d.x - this.mouse.x;
      const dy = d.y - this.mouse.y;
      let boost = Math.exp(-(dx * dx + dy * dy) / (2 * 85 * 85));
      for (const r of this.ripples) {
        const age = (now - r.t) / 1000;
        if (age > 1.4) continue;
        const dist = Math.hypot(d.x - r.x, d.y - r.y);
        const ring = age * 420;
        boost += Math.max(0, 1 - Math.abs(dist - ring) / 28) * (1 - age / 1.4) * 0.6;
      }
      boost = Math.min(1, boost);
      const lit = d.on ? 1 : 0.18;
      const r = base * (d.on ? pulse : 0.55) * (1 + boost * 0.9);
      // Light grey dots on a slightly lighter ground; near the cursor they darken.
      const g = Math.round(205 - (d.on ? 28 : 0) - boost * 150 * lit);
      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
