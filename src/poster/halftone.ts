// A photo printed as a navy halftone on cream. The dot screen is coarse while
// its panel slides in and resolves to a fine screen once it is centred; a lens
// under the cursor shows the original full-colour render.

const INK = '#010736';
const PAPER = '#fcf1d0';
const FINE = 5;
const COARSE = 22;

export class Halftone {
  private ctx: CanvasRenderingContext2D;
  private img = new Image();
  private lum: Float32Array | null = null;
  private lumW = 0;
  private lumH = 0;
  private w = 0;
  private h = 0;
  private dpr = Math.min(devicePixelRatio, 2);
  private cell = COARSE;
  private drawnCell = -1;
  private lens: { x: number; y: number; r: number } = { x: 0, y: 0, r: 0 };
  private lensTarget = 0;
  private raf = 0;

  constructor(private canvas: HTMLCanvasElement, src: string, private reduced: boolean) {
    this.ctx = canvas.getContext('2d')!;
    this.img.decoding = 'async';
    this.img.onload = () => {
      this.sample();
      this.resize();
    };
    this.img.src = src;
    new ResizeObserver(() => this.resize()).observe(canvas);
    if (reduced) this.cell = FINE;

    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.lens.x = e.clientX - r.left;
      this.lens.y = e.clientY - r.top;
      this.lensTarget = Math.min(r.width, r.height) * 0.22;
      this.kick();
    });
    canvas.addEventListener('pointerleave', () => {
      this.lensTarget = 0;
      this.kick();
    });
  }

  /** Pre-compute luminance once at a fixed resolution; draws reuse it. */
  private sample() {
    this.lumW = 320;
    this.lumH = Math.round((320 * this.img.naturalHeight) / this.img.naturalWidth);
    const c = document.createElement('canvas');
    c.width = this.lumW;
    c.height = this.lumH;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(this.img, 0, 0, this.lumW, this.lumH);
    const d = g.getImageData(0, 0, this.lumW, this.lumH).data;
    this.lum = new Float32Array(this.lumW * this.lumH);
    for (let i = 0; i < this.lum.length; i++) {
      this.lum[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
    }
  }

  private resize() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !this.lum) return;
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.drawnCell = -1;
    this.draw();
  }

  get element() {
    return this.canvas;
  }

  /** 0 = centred (fine screen), 1 = at the edge of the track (coarse screen). */
  setDistance(a: number) {
    if (this.reduced) return;
    const t = Math.min(1, Math.max(0, a));
    // Quantised so the screen visibly steps, like changing the printer's LPI.
    this.cell = Math.round(FINE + (COARSE - FINE) * t * t);
    if (this.cell !== this.drawnCell) this.draw();
  }

  private kick() {
    if (!this.raf) this.raf = requestAnimationFrame(this.animateLens);
  }

  private animateLens = () => {
    this.raf = 0;
    this.lens.r += (this.lensTarget - this.lens.r) * (this.reduced ? 1 : 0.2);
    if (Math.abs(this.lensTarget - this.lens.r) < 0.5) this.lens.r = this.lensTarget;
    this.draw(true);
    if (this.lens.r !== this.lensTarget) this.kick();
  };

  private draw(force = false) {
    const { ctx, lum, w, h } = this;
    if (!lum || !w) return;
    if (!force && this.cell === this.drawnCell && this.lens.r === 0) return;
    this.drawnCell = this.cell;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);

    // Cover-fit the image into the canvas, like object-fit: cover.
    const scale = Math.max(w / this.lumW, h / this.lumH);
    const ox = (w - this.lumW * scale) / 2;
    const oy = (h - this.lumH * scale) / 2;
    const cell = this.cell;
    const maxR = cell * 0.62;
    ctx.fillStyle = INK;
    ctx.beginPath();
    // A 45° screen angle, as in print, so the dots don't line up with the frame.
    const cos = Math.SQRT1_2;
    const diag = Math.hypot(w, h);
    for (let v = -diag; v < diag; v += cell) {
      for (let u = -diag; u < diag; u += cell) {
        const x = w / 2 + (u - v) * cos;
        const y = h / 2 + (u + v) * cos;
        if (x < -cell || y < -cell || x > w + cell || y > h + cell) continue;
        const sx = Math.min(this.lumW - 1, Math.max(0, Math.floor((x - ox) / scale)));
        const sy = Math.min(this.lumH - 1, Math.max(0, Math.floor((y - oy) / scale)));
        const r = maxR * Math.sqrt(1 - lum[sy * this.lumW + sx]);
        if (r < 0.35) continue;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
    }
    ctx.fill();

    // Colour lens: the original render, only under the cursor.
    if (this.lens.r > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.lens.x, this.lens.y, this.lens.r, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(this.img, ox, oy, this.lumW * scale, this.lumH * scale);
      ctx.restore();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.lens.x, this.lens.y, this.lens.r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
