import { type Vec3, add, dot, mul, norm, sub } from './math';
import type { Cone, Cylinder, Plane, Scene, Shape, Sphere } from './scene';

const EPS = 1e-4;

export interface Hit { id: string; t: number; point: Vec3; normal: Vec3 }

function hitSphere(s: Sphere, o: Vec3, d: Vec3): number | null {
  const oc = sub(o, s.center);
  const b = dot(oc, d);
  const c = dot(oc, oc) - s.radius * s.radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const q = Math.sqrt(disc);
  const t0 = -b - q;
  if (t0 > EPS) return t0;
  const t1 = -b + q;
  return t1 > EPS ? t1 : null;
}

function hitPlane(p: Plane, o: Vec3, d: Vec3): number | null {
  const den = dot(d, p.normal);
  if (Math.abs(den) < 1e-7) return null;
  const t = dot(sub(p.point, o), p.normal) / den;
  return t > EPS ? t : null;
}

function hitCylinder(c: Cylinder, o: Vec3, d: Vec3): { t: number; normal: Vec3 } | null {
  const a = norm(c.axis);
  const h = c.height / 2;
  let best: { t: number; normal: Vec3 } | null = null;
  const take = (t: number, normal: Vec3) => { if (t > EPS && (!best || t < best.t)) best = { t, normal }; };

  const oc = sub(o, c.center);
  const dA = dot(d, a);
  const ocA = dot(oc, a);
  const dp = sub(d, mul(a, dA));
  const op = sub(oc, mul(a, ocA));
  const qa = dot(dp, dp);
  if (qa > 1e-12) {
    const qb = 2 * dot(dp, op);
    const qc = dot(op, op) - c.radius * c.radius;
    const disc = qb * qb - 4 * qa * qc;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      for (const t of [(-qb - sq) / (2 * qa), (-qb + sq) / (2 * qa)]) {
        if (t <= EPS) continue;
        const along = ocA + t * dA;
        if (Math.abs(along) <= h) take(t, norm(sub(add(oc, mul(d, t)), mul(a, along))));
      }
    }
  }
  if (Math.abs(dA) > 1e-7) {
    for (const sgn of [-1, 1]) {
      const t = (sgn * h - ocA) / dA;
      if (t <= EPS) continue;
      const p = sub(add(oc, mul(d, t)), mul(a, sgn * h));
      if (dot(p, p) <= c.radius * c.radius) take(t, mul(a, sgn));
    }
  }
  return best;
}

/** Cone with its apex at center + axis*h/2 and a base disc of the given radius. */
function hitCone(c: Cone, o: Vec3, d: Vec3): { t: number; normal: Vec3 } | null {
  const a = norm(c.axis);
  const h = c.height;
  const b = mul(a, -1); // from apex towards the base
  const apex = add(c.center, mul(a, h / 2));
  const k2 = (c.radius / h) ** 2;
  let best: { t: number; normal: Vec3 } | null = null;
  const take = (t: number, normal: Vec3) => { if (t > EPS && (!best || t < best.t)) best = { t, normal }; };

  const oc = sub(o, apex);
  const dB = dot(d, b);
  const ocB = dot(oc, b);
  const dp = sub(d, mul(b, dB));
  const op = sub(oc, mul(b, ocB));
  const qa = dot(dp, dp) - k2 * dB * dB;
  const qb = 2 * (dot(dp, op) - k2 * dB * ocB);
  const qc = dot(op, op) - k2 * ocB * ocB;
  const roots: number[] = [];
  if (Math.abs(qa) < 1e-12) {
    if (Math.abs(qb) > 1e-12) roots.push(-qc / qb);
  } else {
    const disc = qb * qb - 4 * qa * qc;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      roots.push((-qb - sq) / (2 * qa), (-qb + sq) / (2 * qa));
    }
  }
  for (const t of roots) {
    const w = ocB + t * dB;
    if (t <= EPS || w < 0 || w > h) continue;
    const v = add(oc, mul(d, t));
    const perp = sub(v, mul(b, w));
    take(t, norm(sub(perp, mul(b, k2 * w))));
  }
  if (Math.abs(dB) > 1e-7) {
    const t = (h - ocB) / dB;
    if (t > EPS) {
      const v = add(oc, mul(d, t));
      const perp = sub(v, mul(b, h));
      if (dot(perp, perp) <= c.radius * c.radius) take(t, b);
    }
  }
  return best;
}

export function intersectShape(s: Shape, o: Vec3, d: Vec3): { t: number; normal: Vec3 } | null {
  if (s.kind === 'sphere') {
    const t = hitSphere(s, o, d);
    return t === null ? null : { t, normal: norm(sub(add(o, mul(d, t)), s.center)) };
  }
  if (s.kind === 'plane') {
    const t = hitPlane(s, o, d);
    return t === null ? null : { t, normal: norm(s.normal) };
  }
  return s.kind === 'cone' ? hitCone(s, o, d) : hitCylinder(s, o, d);
}

/** Nearest shape along a ray. */
export function intersect(scene: Scene, o: Vec3, d: Vec3): Hit | null {
  let best: Hit | null = null;
  for (const s of scene.shapes) {
    const r = intersectShape(s, o, d);
    if (r && (!best || r.t < best.t)) {
      best = { id: s.id, t: r.t, point: add(o, mul(d, r.t)), normal: r.normal };
    }
  }
  return best;
}
