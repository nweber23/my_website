import { type Vec3, add, closestOnLine, cross, dot, len, mul, norm, rayPlane, round, sub } from './math';
import { intersect } from './pick';
import { Renderer } from './renderer';
import { type Item, type Light, MAX_COORD, isAxial, itemPosition, setItemPosition } from './scene';
import type { Store } from './store';
import { View } from './view';

type HandleId = 'x' | 'y' | 'z' | 'plane' | 'radius' | 'height' | 'dir';

interface Handle {
  id: HandleId;
  x: number;
  y: number;
  /** Screen position of the handle's anchor, for the connecting line. */
  fromX: number;
  fromY: number;
  r: number;
  color: string;
}

type Drag =
  | { mode: 'orbit'; lastX: number; lastY: number; downX: number; downY: number; moved: boolean; clickId: string | null }
  | { mode: 'pan'; lastX: number; lastY: number }
  | { mode: 'pinch'; dist: number; mx: number; my: number }
  | {
      mode: 'handle';
      id: HandleId;
      start: Vec3;
      s0: number;
      planeN: Vec3;
      offset: Vec3;
      R0: number;
    }
  | { mode: 'body'; start: Vec3; planeN: Vec3; offset: Vec3; downX: number; downY: number; moved: boolean };

const AXES: Record<'x' | 'y' | 'z', { dir: Vec3; color: string }> = {
  x: { dir: [1, 0, 0], color: '#ff6b5e' },
  y: { dir: [0, 1, 0], color: '#6fdc8c' },
  z: { dir: [0, 0, 1], color: '#5eaaff' },
};
const INK = '#010736';
const CREAM = '#fcf1d0';
const MAX_SAMPLES = 24;
const SETTLE_MS = 180;

/** Halton sequence for well-spread sub-pixel jitter. */
function halton(i: number, base: number) {
  let f = 1, r = 0;
  for (let n = i + 1; n > 0; n = Math.floor(n / base)) { f /= base; r += f * (n % base); }
  return r;
}

export interface ViewportOptions {
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  overlay: HTMLCanvasElement;
  store: Store;
  onStatus: (msg: string) => void;
}

export class Viewport {
  readonly view = new View();
  private renderer: Renderer;
  private octx: CanvasRenderingContext2D;
  private store: Store;
  private stage: HTMLElement;
  private overlay: HTMLCanvasElement;
  private cssW = 1;
  private cssH = 1;
  private dpr = 1;
  private samples = 0;
  private dirty = true;
  private interacting = false;
  private settleTimer = 0;
  private orbitDist = 9;
  private drag: Drag | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private hover: HandleId | null = null;
  private handles: Handle[] = [];
  private raf = 0;
  private suspended = false;
  /** 0.5, 1 or 'native'. */
  quality: number | 'native' = 1;
  snap = false;
  onStats: ((text: string) => void) | null = null;
  private onStatus: (msg: string) => void;

  constructor(o: ViewportOptions) {
    this.store = o.store;
    this.stage = o.stage;
    this.overlay = o.overlay;
    this.onStatus = o.onStatus;
    this.renderer = new Renderer(o.canvas);
    this.octx = o.overlay.getContext('2d')!;
    this.renderer.onLost = () => { this.suspended = true; this.onStatus('Graphics context lost, waiting for the browser to restore it.'); };
    this.renderer.onRestored = () => { this.suspended = false; this.invalidate(); this.onStatus('Graphics context restored.'); };

    this.orbitDist = Math.max(3, len(sub([0, 0, 0], this.store.scene.camera.pos)));
    new ResizeObserver(() => this.resize()).observe(o.stage);
    this.resize();

    const el = o.overlay;
    el.addEventListener('pointerdown', (e) => this.onDown(e));
    el.addEventListener('pointermove', (e) => this.onMove(e));
    el.addEventListener('pointerup', (e) => this.onUp(e));
    el.addEventListener('pointercancel', (e) => this.onUp(e));
    el.addEventListener('lostpointercapture', (e) => this.onUp(e));
    el.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('keydown', (e) => this.onKey(e));

    this.store.on((c) => { if (c !== 'history') this.invalidate(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.invalidate(); });
    this.loop();
  }

  // --- sizing and render loop -------------------------------------------------

  private resize() {
    const r = this.stage.getBoundingClientRect();
    this.cssW = Math.max(1, Math.round(r.width));
    this.cssH = Math.max(1, Math.round(r.height));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.overlay.width = Math.round(this.cssW * this.dpr);
    this.overlay.height = Math.round(this.cssH * this.dpr);
    this.invalidate();
  }

  invalidate() {
    this.samples = 0;
    this.dirty = true;
  }

  /** Re-render after the quality setting changed. */
  setQuality(q: number | 'native') {
    this.quality = q;
    this.invalidate();
  }

  private scale() {
    const base = this.quality === 'native' ? this.dpr : this.quality;
    const s = this.interacting ? Math.min(base, 0.5) : base;
    // Keep the pixel count sane on very large or dense screens.
    const maxPixels = 4.5e6;
    const px = this.cssW * this.cssH * s * s;
    return px > maxPixels ? s * Math.sqrt(maxPixels / px) : s;
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (this.suspended || document.hidden) return;
    const scene = this.store.scene;
    this.view.sync(scene, this.cssW, this.cssH);

    if (this.dirty || this.interacting || this.samples < MAX_SAMPLES) {
      const sc = this.scale();
      const w = Math.max(1, Math.round(this.cssW * sc));
      const h = Math.max(1, Math.round(this.cssH * sc));
      this.renderer.resize(w, h);
      // A fresh frame replaces the buffer; later passes blend in at 1/(n+1).
      const n = this.dirty || this.interacting ? 0 : this.samples;
      const jitter: [number, number] = n === 0 ? [0, 0] : [halton(n, 2) - 0.5, halton(n, 3) - 0.5];
      this.renderer.render(scene, { selectedId: this.store.selectedId, jitter, alpha: 1 / (n + 1) });
      this.samples = this.interacting ? 0 : n + 1;
      this.dirty = false;
      this.drawOverlay();
      this.onStats?.(`${w}×${h} · ${this.interacting ? 'draft' : this.samples >= MAX_SAMPLES ? 'converged' : `refining ${this.samples}/${MAX_SAMPLES}`}`);
    }
  };

  /** One full-quality frame at a chosen size, for saving. */
  async capture(width: number): Promise<Blob | null> {
    const aspect = this.cssH / this.cssW;
    const w = Math.round(width);
    const h = Math.max(1, Math.round(width * aspect));
    const scene = this.store.scene;
    this.renderer.resize(w, h);
    for (let i = 0; i < 16; i++) {
      this.renderer.render(scene, { selectedId: null, jitter: i === 0 ? [0, 0] : [halton(i, 2) - 0.5, halton(i, 3) - 0.5], alpha: 1 / (i + 1) });
      if (i % 4 === 3) await new Promise((r) => requestAnimationFrame(() => r(null)));
    }
    const blob = await new Promise<Blob | null>((res) => this.renderer.canvas.toBlob(res, 'image/png'));
    this.invalidate();
    return blob;
  }

  private bump() {
    this.interacting = true;
    this.invalidate();
    window.clearTimeout(this.settleTimer);
    this.settleTimer = window.setTimeout(() => { this.interacting = false; this.invalidate(); }, SETTLE_MS);
  }

  // --- camera -----------------------------------------------------------------

  /** Orbit state is derived from the camera so inspector edits and undo stay consistent. */
  private orbitTarget(): Vec3 {
    const c = this.store.scene.camera;
    return add(c.pos, mul(norm(c.dir, [0, 0, 1]), this.orbitDist));
  }

  private setCamera(target: Vec3, yaw: number, pitch: number, dist: number) {
    const cp = Math.cos(pitch);
    const fwd: Vec3 = [cp * Math.sin(yaw), Math.sin(pitch), cp * Math.cos(yaw)];
    this.orbitDist = dist;
    this.store.mutate((s) => {
      s.camera.dir = fwd;
      s.camera.pos = sub(target, mul(fwd, dist)).map((v) => Math.max(-MAX_COORD, Math.min(MAX_COORD, v))) as Vec3;
    });
  }

  private orbitBy(dx: number, dy: number) {
    const f = norm(this.store.scene.camera.dir, [0, 0, 1]);
    const yaw = Math.atan2(f[0], f[2]) + dx * 0.006;
    const pitch = Math.max(-1.5, Math.min(1.5, Math.asin(Math.max(-1, Math.min(1, f[1]))) - dy * 0.006));
    this.setCamera(this.orbitTarget(), yaw, pitch, this.orbitDist);
  }

  private panBy(dx: number, dy: number) {
    const k = (this.orbitDist * 2 * this.view.tanHalf) / this.cssW;
    const shift = add(mul(this.view.right, -dx * k), mul(this.view.up, dy * k));
    this.store.mutate((s) => { s.camera.pos = add(s.camera.pos, shift); });
  }

  private zoomBy(factor: number) {
    const target = this.orbitTarget();
    const f = norm(this.store.scene.camera.dir, [0, 0, 1]);
    const dist = Math.max(0.4, Math.min(600, this.orbitDist * factor));
    this.setCamera(target, Math.atan2(f[0], f[2]), Math.asin(Math.max(-1, Math.min(1, f[1]))), dist);
  }

  /** Keep the orbit pivot where the user is looking after a preset or import. */
  resetOrbit() {
    const c = this.store.scene.camera;
    const fwd = norm(c.dir, [0, 0, 1]);
    // Distance from the camera to the point on its axis closest to the origin.
    const t = dot(sub([0, 0, 0], c.pos), fwd);
    this.orbitDist = Math.max(3, Math.min(60, t > 1 ? t : 9));
    this.invalidate();
  }

  // --- handles ---------------------------------------------------------------

  private computeHandles(): Handle[] {
    const it = this.store.selected;
    if (!it) return [];
    const v = this.view;
    const P = itemPosition(it);
    const c = v.project(P);
    if (!c) return [];
    const L = v.pixelsToWorld(P, 86);
    const out: Handle[] = [];
    const push = (id: HandleId, w: Vec3, color: string, r = 8) => {
      const s = v.project(w);
      if (s) out.push({ id, x: s.x, y: s.y, fromX: c.x, fromY: c.y, r, color });
    };

    if (it.kind === 'sphere') {
      push('radius', add(P, mul(v.right, it.radius)), CREAM, 7);
    } else if (isAxial(it)) {
      const a = norm(it.axis);
      let perp = sub(v.right, mul(a, dot(v.right, a)));
      perp = len(perp) < 1e-3 ? norm(cross(a, [0, 0, 1]), [1, 0, 0]) : norm(perp);
      // A cone's radius lives at its base, not at the middle of the axis.
      const ringAt = it.kind === 'cone' ? sub(P, mul(a, it.height / 2)) : P;
      push('radius', add(ringAt, mul(perp, it.radius)), CREAM, 7);
      push('height', add(P, mul(a, it.height / 2)), CREAM, 7);
      push('dir', add(P, mul(a, it.height / 2 + L * 0.6)), '#ffd166', 8);
    } else if (it.kind === 'plane') {
      push('dir', add(P, mul(norm(it.normal), L * 1.25)), '#ffd166', 8);
    }
    for (const k of ['x', 'y', 'z'] as const) push(k, add(P, mul(AXES[k].dir, L)), AXES[k].color, 8);
    out.push({ id: 'plane', x: c.x, y: c.y, fromX: c.x, fromY: c.y, r: 9, color: CREAM });
    return out;
  }

  private handleAt(x: number, y: number): Handle | null {
    const slack = window.matchMedia('(pointer: coarse)').matches ? 14 : 5;
    let best: Handle | null = null;
    let bestD = Infinity;
    // Later handles are the axes and centre; specific ones (radius, height, dir) win ties.
    for (const h of this.handles) {
      const d = Math.hypot(h.x - x, h.y - y);
      const reach = h.r + slack;
      const bias = h.id === 'plane' ? 0.5 : 0; // prefer arrows over the centre when stacked
      if (d <= reach && d + bias < bestD) { best = h; bestD = d + bias; }
    }
    return best;
  }

  private lightAt(x: number, y: number): Light | null {
    const slack = window.matchMedia('(pointer: coarse)').matches ? 20 : 13;
    let best: Light | null = null;
    let bestD = Infinity;
    for (const l of this.store.scene.lights) {
      const s = this.view.project(l.pos);
      if (!s) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d <= slack && d < bestD) { best = l; bestD = d; }
    }
    return best;
  }

  // --- pointer input ----------------------------------------------------------

  private local(e: PointerEvent | WheelEvent) {
    const r = this.overlay.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private bodyPlane(): Vec3 {
    // A level camera sees the floor edge-on, so dragging there uses the camera plane instead.
    return Math.abs(this.view.fwd[1]) < 0.15 ? mul(this.view.fwd, -1) : [0, 1, 0];
  }

  private onDown(e: PointerEvent) {
    this.overlay.focus({ preventScroll: true });
    const { x, y } = this.local(e);
    this.pointers.set(e.pointerId, { x, y });
    this.overlay.setPointerCapture(e.pointerId);

    if (this.pointers.size === 2) {
      this.finishDrag();
      const [a, b] = [...this.pointers.values()];
      this.drag = { mode: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      return;
    }
    if (this.pointers.size > 2) return;

    const panning = e.button === 1 || e.button === 2 || e.shiftKey;
    if (panning) { this.drag = { mode: 'pan', lastX: x, lastY: y }; return; }

    const ray = this.view.ray(x, y);
    const cam = this.view.pos;

    const h = this.handleAt(x, y);
    if (h && this.store.selected) {
      const it = this.store.selected;
      const P = itemPosition(it);
      this.store.begin();
      const planeN: Vec3 = h.id === 'plane' ? this.bodyPlane() : mul(this.view.fwd, -1);
      const hit = rayPlane(cam, ray, P, planeN);
      let s0 = 0;
      if (h.id === 'x' || h.id === 'y' || h.id === 'z') s0 = closestOnLine(P, AXES[h.id].dir, cam, ray) ?? 0;
      const R0 = h.id === 'dir' ? Math.max(0.2, len(sub(this.dirHandleWorld(it), P))) : 0;
      this.drag = { mode: 'handle', id: h.id, start: [...P], s0, planeN, offset: hit ? sub(P, hit) : [0, 0, 0], R0 };
      this.bump();
      return;
    }

    const light = this.lightAt(x, y);
    if (light) {
      this.store.select(light.id);
      this.beginBody(light, x, y, ray);
      return;
    }
    const hit = intersect(this.store.scene, cam, ray);
    const shape = hit && this.store.scene.shapes.find((s) => s.id === hit.id);
    if (hit && shape && shape.kind !== 'plane') {
      this.store.select(hit.id);
      const it = this.store.selected;
      if (it) this.beginBody(it, x, y, ray);
      return;
    }
    // Empty space and planes orbit on drag and select on click. Planes are infinite, so inside a
    // room they cover every pixel; dragging them would make the camera impossible to move.
    this.drag = { mode: 'orbit', lastX: x, lastY: y, downX: x, downY: y, moved: false, clickId: shape ? shape.id : null };
  }

  private beginBody(it: Item, x: number, y: number, ray: Vec3) {
    const P = itemPosition(it);
    const planeN = this.bodyPlane();
    const hit = rayPlane(this.view.pos, ray, P, planeN);
    this.store.begin();
    this.drag = { mode: 'body', start: [...P], planeN, offset: hit ? sub(P, hit) : [0, 0, 0], downX: x, downY: y, moved: false };
  }

  /** World position of the direction handle, matching computeHandles(). */
  private dirHandleWorld(it: Item): Vec3 {
    const P = itemPosition(it);
    const L = this.view.pixelsToWorld(P, 86);
    if (isAxial(it)) return add(P, mul(norm(it.axis), it.height / 2 + L * 0.6));
    if (it.kind === 'plane') return add(P, mul(norm(it.normal), L * 1.25));
    return P;
  }

  private snapPos(next: Vec3, start: Vec3): Vec3 {
    if (!this.snap) return next;
    return next.map((v, i) => (Math.abs(v - start[i]) > 1e-9 ? round(v, 0.25) : v)) as Vec3;
  }

  private onMove(e: PointerEvent) {
    const { x, y } = this.local(e);
    const prev = this.pointers.get(e.pointerId);
    if (prev) { prev.x = x; prev.y = y; }
    const d = this.drag;

    if (!d) {
      const h = this.store.selected ? this.handleAt(x, y) : null;
      const id = h?.id ?? null;
      const overItem = !id && (this.lightAt(x, y) || intersect(this.store.scene, this.view.pos, this.view.ray(x, y)));
      this.overlay.style.cursor = id ? 'grab' : overItem ? 'pointer' : 'default';
      if (id !== this.hover) { this.hover = id; this.drawOverlay(); }
      return;
    }

    if (d.mode === 'orbit') {
      if (!d.moved && Math.hypot(x - d.downX, y - d.downY) < 4) return;
      d.moved = true;
      this.orbitBy(x - d.lastX, y - d.lastY); d.lastX = x; d.lastY = y; this.bump(); return;
    }
    if (d.mode === 'pan') { this.panBy(x - d.lastX, y - d.lastY); d.lastX = x; d.lastY = y; this.bump(); return; }
    if (d.mode === 'pinch') {
      if (this.pointers.size < 2) return;
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      this.panBy(mx - d.mx, my - d.my);
      this.zoomBy(d.dist / dist);
      d.dist = dist; d.mx = mx; d.my = my;
      this.bump();
      return;
    }

    const it = this.store.selected;
    if (!it) return;
    const ray = this.view.ray(x, y);
    const cam = this.view.pos;

    if (d.mode === 'body') {
      if (!d.moved && Math.hypot(x - d.downX, y - d.downY) < 4) return;
      d.moved = true;
      const hit = rayPlane(cam, ray, d.start, d.planeN);
      if (!hit) return;
      const next = this.snapPos(add(hit, d.offset), d.start);
      this.store.mutate(() => setItemPosition(it, next));
      this.bump();
      return;
    }

    // Handle drag.
    const P = d.start;
    if (d.id === 'x' || d.id === 'y' || d.id === 'z') {
      const dir = AXES[d.id].dir;
      const s = closestOnLine(P, dir, cam, ray);
      if (s === null) return;
      const next = this.snapPos(add(P, mul(dir, s - d.s0)), P);
      this.store.mutate(() => setItemPosition(it, next));
    } else if (d.id === 'plane') {
      const hit = rayPlane(cam, ray, P, d.planeN);
      if (!hit) return;
      const next = this.snapPos(add(hit, d.offset), P);
      this.store.mutate(() => setItemPosition(it, next));
    } else if (d.id === 'radius') {
      const ring = it.kind === 'cone' ? sub(P, mul(norm(it.axis), it.height / 2)) : P;
      const hit = rayPlane(cam, ray, ring, d.planeN);
      if (!hit) return;
      let v = sub(hit, ring);
      if (isAxial(it)) { const a = norm(it.axis); v = sub(v, mul(a, dot(v, a))); }
      let r = Math.max(0.02, Math.min(500, len(v)));
      if (this.snap) r = Math.max(0.05, round(r, 0.05));
      this.store.mutate(() => { if (it.kind === 'sphere' || isAxial(it)) it.radius = r; });
    } else if (d.id === 'height' && isAxial(it)) {
      const s = closestOnLine(P, norm(it.axis), cam, ray);
      if (s === null) return;
      let h = Math.max(0.05, Math.min(1000, Math.abs(s) * 2));
      if (this.snap) h = Math.max(0.05, round(h, 0.25));
      this.store.mutate(() => { if (isAxial(it)) it.height = h; });
    } else if (d.id === 'dir') {
      const dir = this.arcball(P, d.R0, cam, ray);
      if (!dir) return;
      this.store.mutate(() => {
        if (it.kind === 'plane') it.normal = dir;
        else if (isAxial(it)) it.axis = dir;
      });
    }
    this.bump();
  }

  /** Direction from `centre` to where the ray meets (or comes closest to) a sphere of radius R. */
  private arcball(centre: Vec3, R: number, o: Vec3, ray: Vec3): Vec3 | null {
    const oc = sub(o, centre);
    const b = dot(oc, ray);
    const c = dot(oc, oc) - R * R;
    const disc = b * b - c;
    let p: Vec3;
    if (disc >= 0) p = add(o, mul(ray, -b - Math.sqrt(disc)));
    else p = add(o, mul(ray, -b)); // closest approach, projected onto the sphere below
    let v = sub(p, centre);
    if (len(v) < 1e-6) return null;
    v = norm(v);
    if (this.snap) {
      for (const axis of [[1, 0, 0], [0, 1, 0], [0, 0, 1]] as Vec3[]) {
        const d = dot(v, axis);
        if (Math.abs(d) > 0.985) return mul(axis, Math.sign(d));
      }
    }
    return v;
  }

  private finishDrag() {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    if (d.mode === 'handle' || d.mode === 'body') this.store.end();
    this.invalidate();
  }

  private onUp(e: PointerEvent) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    if (this.overlay.hasPointerCapture(e.pointerId)) this.overlay.releasePointerCapture(e.pointerId);
    const d = this.drag;
    if (d?.mode === 'orbit' && !d.moved && e.type === 'pointerup') this.store.select(d.clickId);
    this.finishDrag();
    this.drawOverlay();
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 33 : 1;
    this.zoomBy(Math.exp(Math.max(-200, Math.min(200, e.deltaY * unit)) * 0.0014));
    this.bump();
  }

  private onKey(e: KeyboardEvent) {
    const it = this.store.selected;
    const step = (e.shiftKey ? 1 : 0.25);
    let delta: Vec3 | null = null;
    switch (e.key) {
      case 'ArrowLeft': delta = [-step, 0, 0]; break;
      case 'ArrowRight': delta = [step, 0, 0]; break;
      case 'ArrowUp': delta = [0, 0, step]; break;
      case 'ArrowDown': delta = [0, 0, -step]; break;
      case 'PageUp': delta = [0, step, 0]; break;
      case 'PageDown': delta = [0, -step, 0]; break;
      default: return;
    }
    if (!it) return;
    e.preventDefault();
    const d = delta;
    this.store.tweak(() => setItemPosition(it, add(itemPosition(it), d)));
  }

  // --- overlay ----------------------------------------------------------------

  private drawOverlay() {
    const g = this.octx;
    const dpr = this.overlay.width / this.cssW;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, this.cssW, this.cssH);
    const v = this.view;
    const scene = this.store.scene;

    // Lights are points, not geometry, so the shader can't show them.
    for (const l of scene.lights) {
      const s = v.project(l.pos);
      if (!s) continue;
      const sel = l.id === this.store.selectedId;
      const col = `rgb(${l.color[0]},${l.color[1]},${l.color[2]})`;
      g.lineWidth = 2;
      g.strokeStyle = INK;
      g.fillStyle = col;
      g.beginPath(); g.arc(s.x, s.y, 6, 0, Math.PI * 2); g.fill(); g.stroke();
      g.strokeStyle = sel ? '#ffd166' : CREAM;
      g.beginPath(); g.arc(s.x, s.y, 10, 0, Math.PI * 2); g.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.beginPath();
        g.moveTo(s.x + Math.cos(a) * 13, s.y + Math.sin(a) * 13);
        g.lineTo(s.x + Math.cos(a) * 17, s.y + Math.sin(a) * 17);
        g.stroke();
      }
    }

    this.handles = this.computeHandles();
    for (const h of this.handles) {
      if (h.id === 'plane') continue;
      g.lineCap = 'round';
      g.strokeStyle = INK; g.lineWidth = 4;
      g.beginPath(); g.moveTo(h.fromX, h.fromY); g.lineTo(h.x, h.y); g.stroke();
      g.strokeStyle = h.color; g.lineWidth = 2;
      g.beginPath(); g.moveTo(h.fromX, h.fromY); g.lineTo(h.x, h.y); g.stroke();
    }
    for (const h of this.handles) {
      const hot = this.hover === h.id || (this.drag?.mode === 'handle' && this.drag.id === h.id);
      g.lineWidth = 2;
      g.strokeStyle = INK;
      g.fillStyle = hot ? '#ffffff' : h.color;
      g.beginPath();
      if (h.id === 'plane') g.rect(h.x - h.r / 2 - (hot ? 1 : 0), h.y - h.r / 2 - (hot ? 1 : 0), h.r + (hot ? 2 : 0), h.r + (hot ? 2 : 0));
      else if (h.id === 'radius' || h.id === 'height') g.rect(h.x - 5, h.y - 5, 10, 10);
      else if (h.id === 'dir') { g.moveTo(h.x, h.y - 9); g.lineTo(h.x + 9, h.y); g.lineTo(h.x, h.y + 9); g.lineTo(h.x - 9, h.y); g.closePath(); }
      else g.arc(h.x, h.y, hot ? h.r + 1.5 : h.r, 0, Math.PI * 2);
      g.fill(); g.stroke();
    }

    // Orientation widget.
    const ox = 44, oy = this.cssH - 44, k = 26;
    g.font = '11px "Space Mono", monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const axes = (['x', 'y', 'z'] as const)
      .map((a) => ({ a, px: dot(AXES[a].dir, v.right) * k, py: -dot(AXES[a].dir, v.up) * k, depth: dot(AXES[a].dir, v.fwd) }))
      .sort((p, q) => q.depth - p.depth);
    for (const ax of axes) {
      g.strokeStyle = INK; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + ax.px, oy + ax.py); g.stroke();
      g.strokeStyle = AXES[ax.a].color; g.lineWidth = 2;
      g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + ax.px, oy + ax.py); g.stroke();
      g.fillStyle = AXES[ax.a].color;
      g.fillText(ax.a.toUpperCase(), ox + ax.px * 1.38, oy + ax.py * 1.38);
    }
  }

  destroy() {
    cancelAnimationFrame(this.raf);
  }
}
