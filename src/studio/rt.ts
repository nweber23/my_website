import { type Vec3, clamp, len, norm } from './math';
import { LIMITS, type RGB, type Scene, defaultMat, emptyScene, newId } from './scene';

export interface ParseResult {
  scene: Scene;
  /** Lines that were skipped or repaired. */
  issues: string[];
}

const NUM = /^[+-]?(\d+\.?\d*|\.\d+)$/;

function triple(tok: string | undefined): Vec3 | null {
  if (!tok) return null;
  const p = tok.split(',');
  if (p.length !== 3 || !p.every((x) => NUM.test(x))) return null;
  return [Number(p[0]), Number(p[1]), Number(p[2])];
}

const scalar = (tok: string | undefined) => (tok !== undefined && NUM.test(tok) ? Number(tok) : null);

/** Parses a miniRT scene file. Bad lines are skipped and reported, never thrown. */
export function parseRt(text: string): ParseResult {
  const scene = emptyScene();
  const issues: string[] = [];
  let hasA = false;
  let hasC = false;

  const color = (t: Vec3, line: number): RGB => {
    const c = t.map((v) => Math.round(clamp(v, 0, 255))) as RGB;
    if (t.some((v, i) => v !== c[i])) issues.push(`line ${line}: colour out of 0–255, clamped`);
    return c;
  };
  const direction = (t: Vec3, line: number): Vec3 | null => {
    if (len(t) < 1e-9) { issues.push(`line ${line}: zero-length direction, skipped`); return null; }
    if (t.some((v) => Math.abs(v) > 1)) issues.push(`line ${line}: direction outside [-1,1], normalised`);
    return norm(t);
  };

  text.split(/\r?\n/).forEach((raw, i) => {
    const n = i + 1;
    const line = raw.replace(/#.*/, '').trim();
    if (!line) return;
    const t = line.split(/\s+/);
    const id = t[0];
    const bad = (why: string) => issues.push(`line ${n}: ${why}, skipped`);

    if (id === 'A') {
      const ratio = scalar(t[1]); const c = triple(t[2]);
      if (t.length !== 3 || ratio === null || !c) return bad('expected "A ratio r,g,b"');
      if (hasA) return bad('duplicate ambient light');
      hasA = true;
      scene.ambient = { ratio: clamp(ratio, 0, 1), color: color(c, n) };
      if (ratio < 0 || ratio > 1) issues.push(`line ${n}: ambient ratio outside 0–1, clamped`);
    } else if (id === 'C') {
      const pos = triple(t[1]); const d = triple(t[2]); const fov = scalar(t[3]);
      if (t.length !== 4 || !pos || !d || fov === null) return bad('expected "C x,y,z dx,dy,dz fov"');
      if (hasC) return bad('duplicate camera');
      const dir = direction(d, n);
      if (!dir) return;
      hasC = true;
      scene.camera = { pos, dir, fov: clamp(fov, 10, 170) };
      if (fov < 10 || fov > 170) issues.push(`line ${n}: fov outside 10–170, clamped`);
    } else if (id === 'L') {
      const pos = triple(t[1]); const b = scalar(t[2]); const c = t[3] ? triple(t[3]) : ([255, 255, 255] as Vec3);
      if ((t.length !== 3 && t.length !== 4) || !pos || b === null || !c) return bad('expected "L x,y,z brightness [r,g,b]"');
      if (scene.lights.length >= LIMITS.light) return bad(`more than ${LIMITS.light} lights`);
      scene.lights.push({ id: newId(), kind: 'light', pos, brightness: clamp(b, 0, 1), color: color(c, n) });
      if (b < 0 || b > 1) issues.push(`line ${n}: brightness outside 0–1, clamped`);
    } else if (id === 'sp') {
      const c = triple(t[1]); const d = scalar(t[2]); const col = triple(t[3]);
      if (t.length !== 4 || !c || d === null || !col) return bad('expected "sp x,y,z diameter r,g,b"');
      if (d <= 0) return bad('diameter must be positive');
      if (scene.shapes.filter((s) => s.kind === 'sphere').length >= LIMITS.sphere) return bad(`more than ${LIMITS.sphere} spheres`);
      scene.shapes.push({ id: newId(), kind: 'sphere', center: c, radius: d / 2, mat: defaultMat(color(col, n)) });
    } else if (id === 'pl') {
      const p = triple(t[1]); const nv = triple(t[2]); const col = triple(t[3]);
      if (t.length !== 4 || !p || !nv || !col) return bad('expected "pl x,y,z nx,ny,nz r,g,b"');
      const normal = direction(nv, n);
      if (!normal) return;
      if (scene.shapes.filter((s) => s.kind === 'plane').length >= LIMITS.plane) return bad(`more than ${LIMITS.plane} planes`);
      scene.shapes.push({ id: newId(), kind: 'plane', point: p, normal, mat: defaultMat(color(col, n)) });
    } else if (id === 'cy') {
      const c = triple(t[1]); const a = triple(t[2]); const d = scalar(t[3]); const h = scalar(t[4]); const col = triple(t[5]);
      if (t.length !== 6 || !c || !a || d === null || h === null || !col) return bad('expected "cy x,y,z ax,ay,az diameter height r,g,b"');
      if (d <= 0 || h <= 0) return bad('diameter and height must be positive');
      const axis = direction(a, n);
      if (!axis) return;
      if (scene.shapes.filter((s) => s.kind === 'cylinder').length >= LIMITS.cylinder) return bad(`more than ${LIMITS.cylinder} cylinders`);
      scene.shapes.push({ id: newId(), kind: 'cylinder', center: c, axis, radius: d / 2, height: h, mat: defaultMat(color(col, n)) });
    } else if (id === 'co') {
      // Bonus shape. Position is the centre of the base disc, the axis points to the apex.
      const c = triple(t[1]); const a = triple(t[2]); const d = scalar(t[3]); const h = scalar(t[4]); const col = triple(t[5]);
      if (t.length !== 6 || !c || !a || d === null || h === null || !col) return bad('expected "co x,y,z ax,ay,az diameter height r,g,b"');
      if (d <= 0 || h <= 0) return bad('diameter and height must be positive');
      const axis = direction(a, n);
      if (!axis) return;
      if (scene.shapes.filter((s) => s.kind === 'cone').length >= LIMITS.cone) return bad(`more than ${LIMITS.cone} cones`);
      const mid: Vec3 = [c[0] + axis[0] * h / 2, c[1] + axis[1] * h / 2, c[2] + axis[2] * h / 2];
      scene.shapes.push({ id: newId(), kind: 'cone', center: mid, axis, radius: d / 2, height: h, mat: defaultMat(color(col, n)) });
    } else {
      issues.push(`line ${n}: unknown identifier "${id}", skipped`);
    }
  });

  if (!hasA) issues.push('no ambient light (A) found, using ratio 0.15');
  if (!hasC) issues.push('no camera (C) found, using default view');
  if (!scene.lights.length) issues.push('no light (L) found, the scene will be dark');
  return { scene, issues };
}

const f = (v: number) => {
  const s = (Math.round(v * 1000) / 1000).toFixed(3).replace(/\.?0+$/, '');
  return s === '-0' ? '0' : s;
};
const v3 = (v: Vec3) => v.map(f).join(',');
const rgb = (c: RGB) => c.join(',');
const isWhite = (c: RGB) => c[0] === 255 && c[1] === 255 && c[2] === 255;

/** Writes a scene as a .rt file the 42 miniRT parser accepts. */
export function serializeRt(scene: Scene): string {
  const out: string[] = ['# Built with miniRT Studio — https://nweber.me/minirt-studio.html'];
  out.push(`A ${f(scene.ambient.ratio)} ${rgb(scene.ambient.color)}`);
  out.push(`C ${v3(scene.camera.pos)} ${v3(norm(scene.camera.dir, [0, 0, 1]))} ${Math.round(scene.camera.fov)}`);
  for (const l of scene.lights) {
    out.push(`L ${v3(l.pos)} ${f(l.brightness)}${isWhite(l.color) ? '' : ' ' + rgb(l.color)}`);
  }
  for (const s of scene.shapes) {
    if (s.kind === 'sphere') out.push(`sp ${v3(s.center)} ${f(s.radius * 2)} ${rgb(s.mat.color)}`);
    else if (s.kind === 'plane') out.push(`pl ${v3(s.point)} ${v3(norm(s.normal))} ${rgb(s.mat.color)}`);
    else if (s.kind === 'cone') {
      const a = norm(s.axis);
      const base: Vec3 = [s.center[0] - a[0] * s.height / 2, s.center[1] - a[1] * s.height / 2, s.center[2] - a[2] * s.height / 2];
      out.push(`co ${v3(base)} ${v3(a)} ${f(s.radius * 2)} ${f(s.height)} ${rgb(s.mat.color)}`);
    } else out.push(`cy ${v3(s.center)} ${v3(norm(s.axis))} ${f(s.radius * 2)} ${f(s.height)} ${rgb(s.mat.color)}`);
  }
  return out.join('\n') + '\n';
}
