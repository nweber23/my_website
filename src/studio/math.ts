export type Vec3 = [number, number, number];

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: Vec3, fallback: Vec3 = [0, 1, 0]): Vec3 => {
  const l = len(a);
  return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : fallback;
};
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const round = (v: number, step: number) => Math.round(v / step) * step;

/** Camera basis from the .rt orientation vector. World up is +Y.
 *  Left-handed like most miniRT builds: facing +Z, +X is to the right. */
export function cameraBasis(dir: Vec3) {
  const fwd = norm(dir, [0, 0, 1]);
  const worldUp: Vec3 = Math.abs(fwd[1]) > 0.999 ? [0, 0, fwd[1] > 0 ? -1 : 1] : [0, 1, 0];
  const right = norm(cross(worldUp, fwd), [1, 0, 0]);
  const up = cross(fwd, right);
  return { fwd, right, up };
}

/** Parameter along line (p + t*d) closest to the ray (o + s*r). */
export function closestOnLine(p: Vec3, d: Vec3, o: Vec3, r: Vec3): number | null {
  const w = sub(p, o);
  const a = dot(d, d);
  const b = dot(d, r);
  const c = dot(r, r);
  const dd = dot(d, w);
  const e = dot(r, w);
  const den = a * c - b * b;
  if (Math.abs(den) < 1e-9) return null;
  return (b * e - c * dd) / den;
}

/** Hit point of a ray with the plane through `p` with normal `n`. */
export function rayPlane(o: Vec3, r: Vec3, p: Vec3, n: Vec3): Vec3 | null {
  const den = dot(r, n);
  if (Math.abs(den) < 1e-6) return null;
  const t = dot(sub(p, o), n) / den;
  return t > 0 ? add(o, mul(r, t)) : null;
}
