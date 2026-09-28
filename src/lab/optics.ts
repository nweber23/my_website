// Thin-lens optics for a 50 mm lens on a 36 × 24 mm (full-frame) sensor.
// Every number shown in the lab comes from these formulas; distances in mm.

export const FOCAL = 50;
export const SENSOR_W = 36;
export const SENSOR_H = 24;
/** Circle-of-confusion limit for "acceptably sharp" on full frame. */
export const COC_LIMIT = 0.03;
/** Closest focus distance, measured from the sensor plane. */
export const MIN_FOCUS = 450;
export const APERTURES = [2, 5.6, 16] as const;

/** Lens extension (mm beyond infinity position) needed to focus at s. */
export function extensionFor(s: number): number {
  if (!isFinite(s)) return 0;
  return (FOCAL * FOCAL) / (s - FOCAL);
}

export const MAX_EXTENSION = extensionFor(MIN_FOCUS);

/**
 * The focus ring drives a helicoid, so ring angle is linear in extension.
 * t = 0 is infinity, t = 1 is closest focus.
 */
export function focusFromRing(t: number): number {
  const e = Math.max(0, Math.min(1, t)) * MAX_EXTENSION;
  if (e < 1e-6) return Infinity;
  return FOCAL + (FOCAL * FOCAL) / e;
}

export function ringFromFocus(s: number): number {
  return Math.max(0, Math.min(1, extensionFor(s) / MAX_EXTENSION));
}

/** Image distance behind the rear principal plane for an object at d. */
export function imageDistance(d: number): number {
  if (!isFinite(d)) return FOCAL;
  return (FOCAL * d) / (d - FOCAL);
}

export function hyperfocal(n: number): number {
  return (FOCAL * FOCAL) / (n * COC_LIMIT) + FOCAL;
}

export interface DepthOfField {
  near: number;
  far: number;
  total: number;
}

export function depthOfField(s: number, n: number): DepthOfField {
  const h = hyperfocal(n);
  if (!isFinite(s)) return { near: h, far: Infinity, total: Infinity };
  const near = (s * (h - FOCAL)) / (h + s - 2 * FOCAL);
  const far = s >= h ? Infinity : (s * (h - FOCAL)) / (h - s);
  return { near, far, total: far - near };
}

/** Blur-disc diameter on the sensor (mm) for an object at d when focused at s. */
export function blurDisc(d: number, s: number, n: number): number {
  if (!isFinite(s)) return (FOCAL * FOCAL) / (n * (d - FOCAL));
  if (!isFinite(d)) return (FOCAL * FOCAL) / (n * (s - FOCAL));
  return ((FOCAL * FOCAL) * Math.abs(d - s)) / (n * d * (s - FOCAL));
}

export function formatDistance(mm: number, digits = 2): string {
  if (!isFinite(mm) || mm > 1e6) return '∞';
  const m = mm / 1000;
  if (m >= 10) return `${m.toFixed(1)} m`;
  return `${m.toFixed(digits)} m`;
}
