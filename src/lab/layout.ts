// Scene-space layout of the optical bench. The optical axis runs along +x;
// the sensor sits at x = 0 and the diorama recedes toward +x.
//
// Real subject distances span 0.45 m … 10 m, far too long for a tabletop,
// so the diorama is laid out on a logarithmic scale. The same mapping is
// inverted in the sensor-view shader, so the blur it renders matches the
// thin-lens numbers in the readouts.

import { MIN_FOCUS } from './optics';

export const AXIS_Y = 0.62;
export const SENSOR_X = 0;

/** x where the diorama's closest-focus mark sits. */
export const DIORAMA_X0 = 2.35;
/** Scene units per natural-log unit of distance. */
export const DIORAMA_K = 3.25;
/** Far end of the bench; anything beyond reads as infinity. */
export const DIORAMA_END = DIORAMA_X0 + DIORAMA_K * Math.log(14000 / MIN_FOCUS);

/** Scene units of travel per mm of real lens extension (exaggerated to be visible). */
export const EXTENSION_SCALE = 0.03;

/** Scene units per mm for sizes inside the lens (pupil, element radii). */
export const LENS_SCALE = 1 / 52;

export function distanceToX(mm: number): number {
  if (!isFinite(mm)) return DIORAMA_END + 2;
  return DIORAMA_X0 + DIORAMA_K * Math.log(Math.max(mm, 1) / MIN_FOCUS);
}

export function xToDistance(x: number): number {
  return MIN_FOCUS * Math.exp((x - DIORAMA_X0) / DIORAMA_K);
}

/** Exaggerates how far behind/in front of the sensor an image forms. */
export const DEFOCUS_GAIN = 0.11;
