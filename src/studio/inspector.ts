import { type Vec3, clamp, norm } from './math';
import {
  type Cylinder, type Light, type Material, type Plane, type RGB, type Scene, type Sphere,
  LIMITS, MAX_COORD, canAdd, cloneItem, insertItem, itemLabel, itemPosition, removeItem, setItemPosition,
} from './scene';
import type { Store } from './store';

export const SWATCHES: RGB[] = [
  [230, 70, 70], [245, 160, 60], [245, 215, 80], [110, 205, 120],
  [70, 160, 235], [150, 110, 230], [240, 240, 240], [60, 62, 80],
];

const hex = (c: RGB) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
const unhex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const fmt = (v: number) => String(Math.round(v * 1000) / 1000);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

let uid = 0;

/** Builds the property panels. The selection panel is rebuilt per selection; values refresh in place. */
export class Inspector {
  private syncers: Array<() => void> = [];
  private sceneSyncers: Array<() => void> = [];
  private selBox: HTMLElement;

  constructor(root: HTMLElement, private store: Store, private notify: (msg: string) => void) {
    this.selBox = el('div', 'insp__sel');
    const sceneBox = el('div', 'insp__scene');
    root.append(this.selBox, sceneBox);
    this.buildScene(sceneBox);
    this.rebuild();
  }

  // --- field helpers ---------------------------------------------------------

  private field(label: string, tag?: string) {
    const wrap = el('div', 'field');
    const id = `f${uid++}`;
    const l = el('label', 'field__label', label);
    l.htmlFor = id;
    if (tag) l.append(el('span', 'tag', tag));
    wrap.append(l);
    return { wrap, id };
  }

  /** Scalar with slider and number box. `live` fields apply on every keystroke. */
  private scalar(
    host: HTMLElement, syncers: Array<() => void>, label: string,
    get: () => number | undefined, set: (v: number) => void,
    o: { min: number; max: number; step: number; softMax?: number; tag?: string; unit?: string },
  ) {
    const { wrap, id } = this.field(label, o.tag);
    const row = el('div', 'field__row');
    const range = el('input', 'range');
    range.type = 'range'; range.min = String(o.min); range.max = String(o.softMax ?? o.max); range.step = String(o.step);
    range.setAttribute('aria-label', label);
    const num = el('input', 'num');
    num.type = 'number'; num.id = id; num.min = String(o.min); num.max = String(o.max); num.step = String(o.step);
    num.inputMode = 'decimal';
    const apply = (raw: string) => {
      const v = parseFloat(raw);
      if (!Number.isFinite(v)) return;
      set(clamp(v, o.min, o.max));
    };
    range.addEventListener('input', () => apply(range.value));
    num.addEventListener('input', () => apply(num.value));
    num.addEventListener('blur', () => syncers.forEach((s) => s()));
    row.append(range, num);
    wrap.append(row);
    host.append(wrap);
    syncers.push(() => {
      const v = get();
      if (v === undefined) return;
      if (document.activeElement !== num) num.value = fmt(v);
      range.value = String(v);
    });
  }

  private vec3(
    host: HTMLElement, syncers: Array<() => void>, label: string,
    get: () => Vec3 | undefined, set: (v: Vec3) => void,
    o: { step: number; normalise?: boolean; tag?: string },
  ) {
    const { wrap } = this.field(label, o.tag);
    const row = el('div', 'field__row field__row--3');
    const inputs = ['x', 'y', 'z'].map((axis) => {
      const i = el('input', 'num');
      i.type = 'number'; i.step = String(o.step); i.inputMode = 'decimal';
      i.setAttribute('aria-label', `${label} ${axis}`);
      row.append(i);
      return i;
    });
    const commit = () => {
      const cur = get();
      if (!cur) return;
      const next = inputs.map((i, k) => {
        const v = parseFloat(i.value);
        return Number.isFinite(v) ? clamp(v, -MAX_COORD, MAX_COORD) : cur[k];
      }) as Vec3;
      if (o.normalise) {
        if (Math.hypot(...next) < 1e-6) return;
        set(norm(next));
      } else set(next);
    };
    // Direction components are normalised as a set, so they apply on commit, not per keystroke.
    inputs.forEach((i) => {
      i.addEventListener(o.normalise ? 'change' : 'input', commit);
      i.addEventListener('blur', () => syncers.forEach((s) => s()));
    });
    wrap.append(row);
    host.append(wrap);
    syncers.push(() => {
      const v = get();
      if (!v) return;
      inputs.forEach((i, k) => { if (document.activeElement !== i) i.value = fmt(v[k]); });
    });
  }

  private colour(
    host: HTMLElement, syncers: Array<() => void>, label: string,
    get: () => RGB | undefined, set: (c: RGB) => void, commit: (fn: () => void) => void,
  ) {
    const { wrap, id } = this.field(label);
    const row = el('div', 'field__row field__row--colour');
    const input = el('input', 'colour');
    input.type = 'color'; input.id = id;
    input.addEventListener('input', () => set(unhex(input.value)));
    row.append(input);
    const sw = el('div', 'swatches');
    for (const c of SWATCHES) {
      const b = el('button', 'swatch');
      b.type = 'button';
      b.style.background = hex(c);
      b.setAttribute('aria-label', `${label} ${hex(c)}`);
      b.addEventListener('click', () => commit(() => set(c)));
      sw.append(b);
    }
    row.append(sw);
    wrap.append(row);
    host.append(wrap);
    syncers.push(() => { const c = get(); if (c) input.value = hex(c); });
  }

  private check(host: HTMLElement, syncers: Array<() => void>, label: string, get: () => boolean | undefined, set: (v: boolean) => void, tag?: string) {
    const { wrap, id } = this.field(label, tag);
    wrap.classList.add('field--check');
    const box = el('input');
    box.type = 'checkbox'; box.id = id;
    box.addEventListener('change', () => set(box.checked));
    wrap.prepend(box);
    host.append(wrap);
    syncers.push(() => { box.checked = get() === true; });
  }

  private button(label: string, onClick: () => void, cls = 'sbtn sbtn--small') {
    const b = el('button', cls, label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  // --- selection panel --------------------------------------------------------

  rebuild() {
    this.selBox.replaceChildren();
    this.syncers = [];
    const it = this.store.selected;
    const head = el('div', 'insp__head');
    if (!it) {
      head.append(el('h2', 'panel__title', 'Selection'));
      this.selBox.append(head, el('p', 'insp__empty', 'Nothing selected. Click a shape or light in the view, or pick one from the object list.'));
      return;
    }

    head.append(el('h2', 'panel__title', itemLabel(this.store.scene, it)));
    const actions = el('div', 'insp__actions');
    actions.append(
      this.button('Duplicate', () => this.duplicate()),
      this.button('Delete', () => this.remove(), 'sbtn sbtn--small sbtn--danger'),
    );
    head.append(actions);
    this.selBox.append(head);
    const box = el('div', 'insp__fields');
    this.selBox.append(box);

    const S = this.syncers;
    const edit = (fn: () => void) => this.store.tweak(fn);
    const once = (fn: () => void) => this.store.apply(fn);
    const id = it.id;
    const live = () => this.store.selected && this.store.selected.id === id ? this.store.selected : undefined;

    this.vec3(box, S, 'Position', () => { const x = live(); return x ? itemPosition(x) : undefined; },
      (v) => edit(() => { const x = live(); if (x) setItemPosition(x, v); }), { step: 0.1 });

    if (it.kind === 'sphere') {
      const sp = () => live() as Sphere | undefined;
      this.scalar(box, S, 'Diameter', () => { const s = sp(); return s ? s.radius * 2 : undefined; },
        (v) => edit(() => { const s = sp(); if (s) s.radius = Math.max(0.01, v) / 2; }), { min: 0.02, max: 1000, softMax: 12, step: 0.05 });
    } else if (it.kind === 'cylinder') {
      const cy = () => live() as Cylinder | undefined;
      this.scalar(box, S, 'Diameter', () => { const c = cy(); return c ? c.radius * 2 : undefined; },
        (v) => edit(() => { const c = cy(); if (c) c.radius = Math.max(0.01, v) / 2; }), { min: 0.02, max: 1000, softMax: 8, step: 0.05 });
      this.scalar(box, S, 'Height', () => cy()?.height,
        (v) => edit(() => { const c = cy(); if (c) c.height = Math.max(0.01, v); }), { min: 0.02, max: 1000, softMax: 12, step: 0.05 });
      this.vec3(box, S, 'Axis', () => cy()?.axis, (v) => edit(() => { const c = cy(); if (c) c.axis = v; }), { step: 0.05, normalise: true });
      this.axisPresets(box, (v) => once(() => { const c = cy(); if (c) c.axis = v; }), () => cy()?.axis);
    } else if (it.kind === 'plane') {
      const pl = () => live() as Plane | undefined;
      this.vec3(box, S, 'Normal', () => pl()?.normal, (v) => edit(() => { const p = pl(); if (p) p.normal = v; }), { step: 0.05, normalise: true });
      this.axisPresets(box, (v) => once(() => { const p = pl(); if (p) p.normal = v; }), () => pl()?.normal);
    }

    if (it.kind === 'light') {
      const li = () => live() as Light | undefined;
      this.scalar(box, S, 'Brightness', () => li()?.brightness,
        (v) => edit(() => { const l = li(); if (l) l.brightness = v; }), { min: 0, max: 1, step: 0.01 });
      this.colour(box, S, 'Colour', () => li()?.color, (c) => edit(() => { const l = li(); if (l) l.color = c; }), once);
      box.append(el('p', 'insp__note', 'Light colour is a bonus feature of miniRT. The mandatory parser only reads brightness.'));
    } else {
      const mat = (): Material | undefined => { const x = live(); return x && x.kind !== 'light' ? x.mat : undefined; };
      this.colour(box, S, 'Colour', () => mat()?.color, (c) => edit(() => { const m = mat(); if (m) m.color = c; }), once);
      this.scalar(box, S, 'Reflectivity', () => mat()?.reflect,
        (v) => edit(() => { const m = mat(); if (m) m.reflect = v; }), { min: 0, max: 1, step: 0.01, tag: 'studio' });
      this.check(box, S, 'Checkerboard', () => mat()?.checker, (v) => once(() => { const m = mat(); if (m) m.checker = v; }), 'studio');
      box.append(el('p', 'insp__note', 'Studio-only options render here but are not written to the .rt file.'));
    }
    this.sync();
  }

  private axisPresets(host: HTMLElement, set: (v: Vec3) => void, get: () => Vec3 | undefined) {
    const row = el('div', 'presets-row');
    const mk = (label: string, v: Vec3) => row.append(this.button(label, () => set(v)));
    mk('X', [1, 0, 0]); mk('Y', [0, 1, 0]); mk('Z', [0, 0, 1]);
    row.append(this.button('Flip', () => { const a = get(); if (a) set([-a[0], -a[1], -a[2]]); }));
    host.append(row);
  }

  // --- scene panel -------------------------------------------------------------

  private buildScene(host: HTMLElement) {
    host.append(el('h2', 'panel__title', 'Scene'));
    const box = el('div', 'insp__fields');
    host.append(box);
    const S = this.sceneSyncers;
    const sc = (): Scene => this.store.scene;
    const edit = (fn: () => void) => this.store.tweak(fn);
    const once = (fn: () => void) => this.store.apply(fn);

    box.append(el('h3', 'group', 'Camera'));
    // Camera moves are view changes, not history steps, so they bypass tweak().
    const view = (fn: () => void) => { this.store.mutate(fn); };
    this.scalar(box, S, 'Field of view', () => sc().camera.fov, (v) => view(() => { sc().camera.fov = clamp(v, 10, 170); }), { min: 10, max: 170, step: 1 });
    this.vec3(box, S, 'Position', () => sc().camera.pos, (v) => view(() => { sc().camera.pos = v; }), { step: 0.1 });
    this.vec3(box, S, 'Direction', () => sc().camera.dir, (v) => view(() => { sc().camera.dir = v; }), { step: 0.05, normalise: true });

    box.append(el('h3', 'group', 'Ambient light'));
    this.scalar(box, S, 'Ratio', () => sc().ambient.ratio, (v) => edit(() => { sc().ambient.ratio = v; }), { min: 0, max: 1, step: 0.01 });
    this.colour(box, S, 'Colour', () => sc().ambient.color, (c) => edit(() => { sc().ambient.color = c; }), once);

    box.append(el('h3', 'group', 'Surface look'));
    this.scalar(box, S, 'Specular', () => sc().look.specular, (v) => edit(() => { sc().look.specular = v; }), { min: 0, max: 1, step: 0.01, tag: 'studio' });
    this.scalar(box, S, 'Shininess', () => sc().look.shine, (v) => edit(() => { sc().look.shine = v; }), { min: 1, max: 256, step: 1, tag: 'studio' });
    this.scalar(box, S, 'Mirror bounces', () => sc().look.bounces, (v) => edit(() => { sc().look.bounces = Math.round(v); }), { min: 0, max: 3, step: 1, tag: 'studio' });
    this.sync();
  }

  sync() {
    this.syncers.forEach((s) => s());
    this.sceneSyncers.forEach((s) => s());
  }

  // --- actions ----------------------------------------------------------------

  duplicate() {
    const it = this.store.selected;
    if (!it) return;
    if (!canAdd(this.store.scene, it.kind)) { this.notify(`The shader holds at most ${LIMITS[it.kind]} of these.`); return; }
    const copy = cloneItem(it);
    setItemPosition(copy, itemPosition(it).map((v, i) => v + (i === 1 ? 0 : 0.8)) as Vec3);
    this.store.apply((s) => insertItem(s, copy));
    this.store.select(copy.id);
  }

  remove() {
    const it = this.store.selected;
    if (!it) return;
    this.store.apply((s) => removeItem(s, it.id));
    this.store.select(null);
  }
}
