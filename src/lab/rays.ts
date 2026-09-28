import * as THREE from 'three';
import { imageDistance } from './optics';
import { AXIS_Y, DEFOCUS_GAIN, DIORAMA_END, DIORAMA_X0, SENSOR_X, distanceToX } from './layout';
import { FRONT_X, Lens, STOP_X } from './lens';

const RAYS = 14;
const TAN_H = 18 / 50;
const TAN_V = 12 / 50;

const additive = (color: number, opacity: number) =>
  new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

/** Where an object point images, and how big its blur disc is on the sensor. */
export interface ImageSolution {
  principal: THREE.Vector3;
  image: THREE.Vector3;
  /** Centre of the blur disc on the sensor plane. */
  spot: THREE.Vector3;
  /** Blur disc radius in scene units. */
  spotRadius: number;
}

export function solveImage(p: THREE.Vector3, focus: number, n: number, ring: number, subjectDistance: number): ImageSolution {
  const c = new THREE.Vector3(STOP_X + Lens.travel(ring), AXIS_Y, 0);
  const dv = imageDistance(subjectDistance) - imageDistance(focus);
  const xi = SENSOR_X - THREE.MathUtils.clamp(dv * DEFOCUS_GAIN, -0.85, 0.85);
  const dir = c.clone().sub(p);
  const image = c.clone().addScaledVector(dir, (c.x - xi) / (p.x - c.x));
  const spot = c.clone().addScaledVector(dir, (c.x - SENSOR_X) / (p.x - c.x));
  const rp = Lens.pupilRadius(n);
  const spotRadius = (rp * Math.abs(xi - SENSOR_X)) / Math.abs(c.x - xi);
  return { principal: c, image, spot, spotRadius };
}

/** Triangle strips between successive rings of points (a ring may collapse to a point). */
class RingStrip {
  readonly mesh: THREE.Mesh;
  private pos: Float32Array;
  constructor(material: THREE.Material, private maxRings: number) {
    this.pos = new Float32Array((maxRings - 1) * RAYS * 6 * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
  }
  set(rings: THREE.Vector3[][]) {
    let o = 0;
    const put = (v: THREE.Vector3) => {
      this.pos[o++] = v.x;
      this.pos[o++] = v.y;
      this.pos[o++] = v.z;
    };
    for (let r = 0; r < rings.length - 1 && r < this.maxRings - 1; r++) {
      const a = rings[r];
      const b = rings[r + 1];
      for (let k = 0; k < RAYS; k++) {
        const k2 = (k + 1) % RAYS;
        put(a[k]);
        put(b[k]);
        put(b[k2]);
        put(a[k]);
        put(b[k2]);
        put(a[k2]);
      }
    }
    const g = this.mesh.geometry;
    g.setDrawRange(0, o / 3);
    g.getAttribute('position').needsUpdate = true;
  }
}

class Polyline {
  readonly lines: THREE.LineSegments;
  private pos: Float32Array;
  private o = 0;
  constructor(material: THREE.LineBasicMaterial, maxSegments: number) {
    this.pos = new Float32Array(maxSegments * 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.lines = new THREE.LineSegments(g, material);
    this.lines.frustumCulled = false;
  }
  begin() {
    this.o = 0;
  }
  seg(a: THREE.Vector3, b: THREE.Vector3) {
    if (this.o + 6 > this.pos.length) return;
    this.pos.set([a.x, a.y, a.z, b.x, b.y, b.z], this.o);
    this.o += 6;
  }
  end() {
    const g = this.lines.geometry;
    g.setDrawRange(0, this.o / 3);
    g.getAttribute('position').needsUpdate = true;
  }
}

const focusPlaneShader = {
  uniforms: {
    uSize: { value: new THREE.Vector2(1, 1) },
    uColor: { value: new THREE.Color(0xff5a1f) },
    uOpacity: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec2 uSize;
    uniform vec3 uColor;
    uniform float uOpacity;
    varying vec2 vUv;
    void main() {
      vec2 p = vUv * uSize;
      vec2 edge = min(p, uSize - p);
      float border = 1.0 - smoothstep(0.006, 0.014, min(edge.x, edge.y));
      vec2 g = abs(fract(p / 0.2 - 0.5) - 0.5) * 0.2;
      float grid = 1.0 - smoothstep(0.0, 0.004, min(g.x, g.y));
      // Corner brackets, like a viewfinder.
      float bl = 0.12 * min(uSize.x, uSize.y);
      float corner = step(min(edge.x, edge.y), 0.02) * step(max(edge.x, edge.y), bl);
      float a = 0.05 + grid * 0.09 + border * 0.55 + corner * 0.45;
      gl_FragColor = vec4(uColor, a * uOpacity);
    }
  `,
};

export class LightPath {
  readonly root = new THREE.Group();
  private objectCone: RingStrip;
  private imageCone: RingStrip;
  private rayLines: Polyline;
  private frustumLines: Polyline;
  private spots: THREE.Mesh[] = [];
  private focusPlane: THREE.Mesh;
  private dofFill: THREE.Mesh;
  private dofPos: Float32Array;
  readonly focusLabel = new THREE.Object3D();
  readonly nearLabel = new THREE.Object3D();
  readonly farLabel = new THREE.Object3D();
  private rayMat: THREE.LineBasicMaterial;
  private coneMats: THREE.MeshBasicMaterial[];

  constructor(subjectColors: number[]) {
    const accent = 0xff7a3d;
    this.coneMats = [additive(accent, 0.11), additive(accent, 0.16)];
    this.objectCone = new RingStrip(this.coneMats[0], 2);
    this.imageCone = new RingStrip(this.coneMats[1], 3);
    this.rayMat = new THREE.LineBasicMaterial({
      color: 0xffb08a,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    this.rayLines = new Polyline(this.rayMat, RAYS * 4);
    this.frustumLines = new Polyline(
      new THREE.LineBasicMaterial({ color: 0xff5a1f, transparent: true, opacity: 0.22, depthWrite: false }),
      16
    );
    this.root.add(this.objectCone.mesh, this.imageCone.mesh, this.rayLines.lines, this.frustumLines.lines);

    const disc = new THREE.CircleGeometry(1, 48).rotateY(Math.PI / 2);
    subjectColors.forEach((c) => {
      const m = new THREE.Mesh(disc, additive(c, 0.5));
      this.spots.push(m);
      this.root.add(m);
    });

    this.focusPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateY(-Math.PI / 2),
      new THREE.ShaderMaterial({
        ...focusPlaneShader,
        uniforms: THREE.UniformsUtils.clone(focusPlaneShader.uniforms),
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.root.add(this.focusPlane);

    this.dofPos = new Float32Array(8 * 3);
    const dofGeo = new THREE.BufferGeometry();
    dofGeo.setAttribute('position', new THREE.BufferAttribute(this.dofPos, 3));
    // Box faces except the two end caps.
    dofGeo.setIndex([0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]);
    this.dofFill = new THREE.Mesh(dofGeo, additive(0xff5a1f, 0.045));
    this.dofFill.frustumCulled = false;
    this.root.add(this.dofFill, this.focusLabel, this.nearLabel, this.farLabel);

  }

  /** Viewing-frustum cross-section at x, clipped to the floor. */
  private section(x: number, cx: number) {
    const d = Math.max(0.01, x - cx);
    const hw = d * TAN_H;
    const top = AXIS_Y + d * TAN_V;
    const bottom = Math.max(0.004, AXIS_Y - d * TAN_V);
    return { hw, top, bottom };
  }

  update(opts: {
    subjects: { anchor: THREE.Vector3; distance: number }[];
    active: number;
    focus: number;
    aperture: number;
    ring: number;
    near: number;
    far: number;
    visibility: number;
  }) {
    const { subjects, active, focus, aperture, ring, visibility } = opts;
    this.root.visible = visibility > 0.01;
    if (!this.root.visible) return;

    this.coneMats[0].opacity = 0.1 * visibility;
    this.coneMats[1].opacity = 0.16 * visibility;
    this.rayMat.opacity = 0.55 * visibility;

    // Blur discs for every subject.
    subjects.forEach((s, i) => {
      const sol = solveImage(s.anchor, focus, aperture, ring, s.distance);
      const spot = this.spots[i];
      const r = Math.max(0.006, sol.spotRadius);
      spot.position.copy(sol.spot).setX(SENSOR_X + 0.004 + i * 0.0005);
      spot.scale.setScalar(r);
      const m = spot.material as THREE.MeshBasicMaterial;
      m.opacity = Math.min(0.9, 0.0009 / (r * r)) * (i === active ? 1 : 0.55) * visibility;
    });

    // Ray fan for the active subject.
    const s = subjects[active];
    const sol = solveImage(s.anchor, focus, aperture, ring, s.distance);
    const c = sol.principal;
    const rp = Lens.pupilRadius(aperture);
    const frontX = FRONT_X + Lens.travel(ring);
    const chief = c.clone().sub(s.anchor);
    const fc = s.anchor.clone().addScaledVector(chief, (frontX - s.anchor.x) / chief.x);
    const front: THREE.Vector3[] = [];
    const pupil: THREE.Vector3[] = [];
    const hits: THREE.Vector3[] = [];
    for (let k = 0; k < RAYS; k++) {
      const a = (k / RAYS) * Math.PI * 2;
      const cy = Math.cos(a);
      const sz = Math.sin(a);
      front.push(new THREE.Vector3(frontX, fc.y + cy * rp * 1.3, fc.z + sz * rp * 1.3));
      const e = new THREE.Vector3(c.x, c.y + cy * rp, c.z + sz * rp);
      pupil.push(e);
      const t = (e.x - SENSOR_X) / (e.x - sol.image.x);
      hits.push(e.clone().lerp(sol.image, t));
    }
    const apex = Array.from({ length: RAYS }, () => s.anchor);
    this.objectCone.set([apex, front]);
    const crosses = sol.image.x > SENSOR_X;
    const img = Array.from({ length: RAYS }, () => sol.image);
    this.imageCone.set(crosses ? [pupil, img, hits] : [pupil, hits]);

    this.rayLines.begin();
    for (let k = 0; k < RAYS; k += 2) {
      this.rayLines.seg(s.anchor, front[k]);
      this.rayLines.seg(front[k], pupil[k]);
      this.rayLines.seg(pupil[k], hits[k]);
    }
    this.rayLines.end();

    // Plane of focus = the frame's cross-section at the focus distance.
    const fx = Math.min(distanceToX(focus), DIORAMA_END);
    const sec = this.section(fx, c.x);
    this.focusPlane.position.set(fx, (sec.top + sec.bottom) / 2, 0);
    this.focusPlane.scale.set(1, sec.top - sec.bottom, sec.hw * 2);
    const u = (this.focusPlane.material as THREE.ShaderMaterial).uniforms;
    u.uSize.value.set(sec.hw * 2, sec.top - sec.bottom);
    // A far plane is huge on screen; keep it from washing over the scene.
    u.uOpacity.value = visibility * THREE.MathUtils.clamp(1.8 / (sec.top - sec.bottom), 0.3, 1);
    this.focusLabel.position.set(fx, sec.top + 0.08, 0);

    // Depth-of-field zone between the near and far limits.
    const nx = THREE.MathUtils.clamp(distanceToX(opts.near), DIORAMA_X0 - 0.3, DIORAMA_END);
    const farX = THREE.MathUtils.clamp(distanceToX(opts.far), DIORAMA_X0 - 0.3, DIORAMA_END);
    const a = this.section(nx, c.x);
    const b = this.section(farX, c.x);
    const corners = [
      [nx, a.bottom, -a.hw],
      [nx, a.top, -a.hw],
      [nx, a.top, a.hw],
      [nx, a.bottom, a.hw],
      [farX, b.bottom, -b.hw],
      [farX, b.top, -b.hw],
      [farX, b.top, b.hw],
      [farX, b.bottom, b.hw],
    ];
    corners.forEach((p, i) => this.dofPos.set(p, i * 3));
    this.dofFill.geometry.getAttribute('position').needsUpdate = true;
    this.dofFill.geometry.computeBoundingSphere();
    (this.dofFill.material as THREE.MeshBasicMaterial).opacity = 0.05 * visibility;
    // Near on the viewer's side of the frame, far on the opposite side, so
    // they never collide when the zone is thin.
    this.nearLabel.position.set(nx, 0.02, a.hw + 0.12);
    this.farLabel.position.set(farX, 0.02, -b.hw - 0.12);

    // Frame edges from the principal point out across the bench.
    this.frustumLines.begin();
    const end = this.section(DIORAMA_END, c.x);
    for (const sy of [1, -1]) {
      for (const sz of [1, -1]) {
        const dir = new THREE.Vector3(1, sy * TAN_V, sz * TAN_H);
        let t = DIORAMA_END - c.x;
        if (sy < 0) t = Math.min(t, (AXIS_Y - 0.002) / TAN_V);
        this.frustumLines.seg(c, c.clone().addScaledVector(dir, t));
      }
    }
    // Floor footprint of the frame at the far end.
    const fz = end.hw;
    this.frustumLines.seg(
      new THREE.Vector3(DIORAMA_END, 0.004, -fz),
      new THREE.Vector3(DIORAMA_END, 0.004, fz)
    );
    this.frustumLines.end();
  }
}
