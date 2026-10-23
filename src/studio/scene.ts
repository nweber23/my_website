import { type Vec3, clamp, norm } from './math';

export type RGB = [number, number, number];

export interface Material {
  color: RGB;
  /** Studio-only extras. They are not part of the 42 .rt format. */
  reflect: number;
  checker: boolean;
}

export interface Sphere { id: string; kind: 'sphere'; center: Vec3; radius: number; mat: Material }
export interface Plane { id: string; kind: 'plane'; point: Vec3; normal: Vec3; mat: Material }
export interface Cylinder { id: string; kind: 'cylinder'; center: Vec3; axis: Vec3; radius: number; height: number; mat: Material }
export interface Light { id: string; kind: 'light'; pos: Vec3; brightness: number; color: RGB }
export type Shape = Sphere | Plane | Cylinder;
export type Item = Shape | Light;
export type Kind = Item['kind'];

export interface Scene {
  ambient: { ratio: number; color: RGB };
  camera: { pos: Vec3; dir: Vec3; fov: number };
  lights: Light[];
  shapes: Shape[];
  /** Studio-only render settings. */
  look: { specular: number; shine: number; bounces: number };
}

/** Limits the shader can hold in uniforms. */
export const LIMITS = { sphere: 16, plane: 8, cylinder: 16, light: 8 } as const;

export const MAX_COORD = 1000;

/** Deepest mirror recursion the shader runs. Facing mirrors need depth to look endless. */
export const MAX_BOUNCES = 8;

let counter = 0;
export const newId = () => `o${Date.now().toString(36)}${(counter++).toString(36)}`;

export const defaultMat = (color: RGB = [200, 200, 200]): Material => ({ color, reflect: 0, checker: false });

export const emptyScene = (): Scene => ({
  ambient: { ratio: 0.15, color: [255, 255, 255] },
  camera: { pos: [0, 3, -9], dir: [0, -0.15, 1], fov: 60 },
  lights: [],
  shapes: [],
  look: { specular: 0.35, shine: 48, bounces: 0 },
});

export function countOf(scene: Scene, kind: Kind) {
  return kind === 'light' ? scene.lights.length : scene.shapes.filter((s) => s.kind === kind).length;
}

export const canAdd = (scene: Scene, kind: Kind) => countOf(scene, kind) < LIMITS[kind];

export function findItem(scene: Scene, id: string | null): Item | undefined {
  if (!id) return undefined;
  return scene.lights.find((l) => l.id === id) ?? scene.shapes.find((s) => s.id === id);
}

export function itemPosition(it: Item): Vec3 {
  switch (it.kind) {
    case 'sphere': case 'cylinder': return it.center;
    case 'plane': return it.point;
    case 'light': return it.pos;
  }
}

export function setItemPosition(it: Item, p: Vec3) {
  const q: Vec3 = [clamp(p[0], -MAX_COORD, MAX_COORD), clamp(p[1], -MAX_COORD, MAX_COORD), clamp(p[2], -MAX_COORD, MAX_COORD)];
  switch (it.kind) {
    case 'sphere': case 'cylinder': it.center = q; break;
    case 'plane': it.point = q; break;
    case 'light': it.pos = q; break;
  }
}

export function itemLabel(scene: Scene, it: Item): string {
  const list = it.kind === 'light' ? scene.lights : scene.shapes.filter((s) => s.kind === it.kind);
  const n = list.findIndex((x) => x.id === it.id) + 1;
  const name = { sphere: 'Sphere', plane: 'Plane', cylinder: 'Cylinder', light: 'Light' }[it.kind];
  return `${name} ${String(n).padStart(2, '0')}`;
}

export function removeItem(scene: Scene, id: string) {
  scene.lights = scene.lights.filter((l) => l.id !== id);
  scene.shapes = scene.shapes.filter((s) => s.id !== id);
}

export function cloneItem(it: Item): Item {
  const c = structuredClone(it);
  c.id = newId();
  return c;
}

export function insertItem(scene: Scene, it: Item) {
  if (it.kind === 'light') scene.lights.push(it);
  else scene.shapes.push(it);
}

/** Coerces untrusted data (URL hash, JSON) into a valid scene, or null. */
export function sanitize(raw: unknown): Scene | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, any>;
  const num = (v: unknown, d: number, lo = -MAX_COORD, hi = MAX_COORD) =>
    typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : d;
  const vec = (v: unknown, d: Vec3): Vec3 =>
    Array.isArray(v) && v.length === 3 ? [num(v[0], d[0]), num(v[1], d[1]), num(v[2], d[2])] : d;
  const rgb = (v: unknown, d: RGB): RGB => {
    const c = vec(v, d);
    return [Math.round(clamp(c[0], 0, 255)), Math.round(clamp(c[1], 0, 255)), Math.round(clamp(c[2], 0, 255))];
  };
  const dir = (v: unknown, d: Vec3) => norm(vec(v, d), d);
  const mat = (m: any): Material => ({
    color: rgb(m?.color, [200, 200, 200]),
    reflect: num(m?.reflect, 0, 0, 1),
    checker: m?.checker === true,
  });

  const out = emptyScene();
  out.ambient = { ratio: num(r.ambient?.ratio, 0.15, 0, 1), color: rgb(r.ambient?.color, [255, 255, 255]) };
  out.camera = {
    pos: vec(r.camera?.pos, out.camera.pos),
    dir: dir(r.camera?.dir, out.camera.dir),
    fov: num(r.camera?.fov, 60, 10, 170),
  };
  out.look = {
    specular: num(r.look?.specular, 0.35, 0, 1),
    shine: num(r.look?.shine, 48, 1, 256),
    bounces: Math.round(num(r.look?.bounces, 0, 0, MAX_BOUNCES)),
  };
  for (const l of Array.isArray(r.lights) ? r.lights : []) {
    if (out.lights.length >= LIMITS.light) break;
    out.lights.push({ id: newId(), kind: 'light', pos: vec(l?.pos, [0, 5, 0]), brightness: num(l?.brightness, 0.7, 0, 1), color: rgb(l?.color, [255, 255, 255]) });
  }
  const counts = { sphere: 0, plane: 0, cylinder: 0 };
  for (const s of Array.isArray(r.shapes) ? r.shapes : []) {
    const kind: unknown = s?.kind;
    if (kind !== 'sphere' && kind !== 'plane' && kind !== 'cylinder') continue;
    if (counts[kind] >= LIMITS[kind]) continue;
    counts[kind]++;
    if (kind === 'sphere') {
      out.shapes.push({ id: newId(), kind, center: vec(s.center, [0, 0, 0]), radius: num(s.radius, 1, 0.01, 500), mat: mat(s.mat) });
    } else if (kind === 'plane') {
      out.shapes.push({ id: newId(), kind, point: vec(s.point, [0, 0, 0]), normal: dir(s.normal, [0, 1, 0]), mat: mat(s.mat) });
    } else {
      out.shapes.push({ id: newId(), kind: 'cylinder', center: vec(s.center, [0, 0, 0]), axis: dir(s.axis, [0, 1, 0]), radius: num(s.radius, 0.5, 0.01, 500), height: num(s.height, 2, 0.01, 1000), mat: mat(s.mat) });
    }
  }
  return out;
}
