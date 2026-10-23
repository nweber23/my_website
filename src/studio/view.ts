import { type Vec3, add, cameraBasis, dot, mul, norm, sub } from './math';
import type { Scene } from './scene';

/** Maps between CSS pixels of the viewport and world space. Matches the shader's ray setup. */
export class View {
  fwd: Vec3 = [0, 0, 1];
  right: Vec3 = [1, 0, 0];
  up: Vec3 = [0, 1, 0];
  pos: Vec3 = [0, 0, 0];
  tanHalf = 1;
  w = 1;
  h = 1;

  sync(scene: Scene, w: number, h: number) {
    const b = cameraBasis(scene.camera.dir);
    this.fwd = b.fwd; this.right = b.right; this.up = b.up;
    this.pos = scene.camera.pos;
    this.tanHalf = Math.tan((scene.camera.fov * Math.PI) / 360);
    this.w = Math.max(1, w); this.h = Math.max(1, h);
  }

  ray(px: number, py: number): Vec3 {
    const x = (2 * px / this.w - 1) * this.tanHalf;
    const y = (1 - 2 * py / this.h) * this.tanHalf * (this.h / this.w);
    return norm(add(add(this.fwd, mul(this.right, x)), mul(this.up, y)));
  }

  /** Screen position plus depth along the view axis, or null behind the camera. */
  project(p: Vec3): { x: number; y: number; z: number } | null {
    const v = sub(p, this.pos);
    const z = dot(v, this.fwd);
    if (z < 0.05) return null;
    const sx = dot(v, this.right) / (z * this.tanHalf);
    const sy = dot(v, this.up) / (z * this.tanHalf * (this.h / this.w));
    return { x: (sx * 0.5 + 0.5) * this.w, y: (0.5 - sy * 0.5) * this.h, z };
  }

  /** World length that covers `px` screen pixels at the depth of `p`. */
  pixelsToWorld(p: Vec3, px: number): number {
    const z = Math.max(0.05, dot(sub(p, this.pos), this.fwd));
    return (px * 2 * z * this.tanHalf) / this.w;
  }
}
