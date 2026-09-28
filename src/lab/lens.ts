import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FOCAL, MAX_EXTENSION, SENSOR_H, SENSOR_W } from './optics';
import { AXIS_Y, EXTENSION_SCALE, LENS_SCALE, SENSOR_X } from './layout';
import {
  apertureScaleTexture,
  focusScaleTexture,
  knurlTexture,
  nameRingTexture,
} from './textures';

/** The cutaway wedge faces the default camera (front, slightly above). */
const PHI_START = Math.PI / 4;
const PHI_LENGTH = Math.PI * 1.5;
const SEGMENTS = 120;

/** Ring travel from infinity to closest focus. */
export const FOCUS_SWEEP = THREE.MathUtils.degToRad(210);
/** u-coordinate of the fixed index mark (the top of the barrel). */
const INDEX_U = 0.75;
const APERTURE_SPAN = 0.25;
const apertureU = (n: number) => Math.log(n / 2) / Math.log(8);

/** x of the aperture stop at infinity focus — also the lens's principal point. */
export const STOP_X = 0.995;
export const FRONT_X = 1.43;
export const REAR_X = 0.6;

type Pt = [r: number, x: number];

function toAxis(g: THREE.BufferGeometry) {
  // Lathe revolves around +y; the optical axis is +x.
  g.rotateZ(-Math.PI / 2);
  return g;
}

/** Re-derive u from the actual angle so textures ignore the cutaway. */
function angularUVs(g: THREE.BufferGeometry) {
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    let phi = Math.atan2(-pos.getY(i), pos.getZ(i));
    if (phi < 0) phi += Math.PI * 2;
    uv.setX(i, phi / (Math.PI * 2));
  }
  uv.needsUpdate = true;
}

/** Lathe a single profile edge so each face keeps a crisp normal. */
function latheEdge(a: Pt, b: Pt, cut: boolean) {
  const g = new THREE.LatheGeometry(
    [new THREE.Vector2(a[0], a[1]), new THREE.Vector2(b[0], b[1])],
    SEGMENTS,
    cut ? PHI_START : 0,
    cut ? PHI_LENGTH : Math.PI * 2
  );
  toAxis(g);
  return g;
}

/** Flat section face where the cutaway slices through a part. */
function capAt(profile: Pt[], phi: number) {
  const shape = new THREE.Shape(profile.map(([r, x]) => new THREE.Vector2(x, r)));
  const g = new THREE.ShapeGeometry(shape);
  const pos = g.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const r = pos.getY(i);
    pos.setXYZ(i, x, -r * Math.sin(phi), r * Math.cos(phi));
  }
  g.computeVertexNormals();
  return g;
}

interface RingOpts {
  r0: number;
  r1: number;
  x0: number;
  x1: number;
  outer: THREE.Material;
  body?: THREE.Material;
  cap: THREE.Material;
  cut?: boolean;
}

/** A tube-shaped barrel section: textured outer skin, plain inner walls, section caps. */
function barrelRing({ r0, r1, x0, x1, outer, body, cap, cut = true }: RingOpts) {
  const group = new THREE.Group();
  const outerGeo = latheEdge([r1, x0], [r1, x1], cut);
  angularUVs(outerGeo);
  group.add(new THREE.Mesh(outerGeo, outer));
  const rest = mergeGeometries([
    latheEdge([r1, x1], [r0, x1], cut),
    latheEdge([r0, x1], [r0, x0], cut),
    latheEdge([r0, x0], [r1, x0], cut),
  ]);
  group.add(new THREE.Mesh(rest, body ?? outer));
  if (cut) {
    const profile: Pt[] = [
      [r0, x0],
      [r1, x0],
      [r1, x1],
      [r0, x1],
    ];
    group.add(new THREE.Mesh(capAt(profile, PHI_START), cap));
    group.add(new THREE.Mesh(capAt(profile, PHI_START + PHI_LENGTH), cap));
  }
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return group;
}

interface ElementSpec {
  name: string;
  note: string;
  x: number;
  r1: number;
  r2: number;
  t: number;
  h: number;
  ed?: boolean;
}

const ELEMENTS: ElementSpec[] = [
  { name: 'G1', note: 'front meniscus', x: 1.4, r1: 0.95, r2: 3.5, t: 0.07, h: 0.335 },
  { name: 'G2', note: 'ED glass', x: 1.25, r1: 0.6, r2: 1.6, t: 0.08, h: 0.3, ed: true },
  { name: 'G3', note: 'negative meniscus', x: 1.14, r1: 2.0, r2: 0.42, t: 0.04, h: 0.28 },
  { name: 'G4', note: 'negative meniscus', x: 0.855, r1: -0.42, r2: -2.0, t: 0.04, h: 0.27 },
  { name: 'G5', note: 'ED glass', x: 0.74, r1: -1.8, r2: -0.6, t: 0.08, h: 0.29, ed: true },
  { name: 'G6', note: 'rear element', x: 0.62, r1: 2.5, r2: -1.2, t: 0.08, h: 0.3 },
];

/** Surface x at height r for a spherical surface with vertex xv and radius R. */
function sag(xv: number, R: number, r: number) {
  return xv - Math.sign(R) * (Math.abs(R) - Math.sqrt(R * R - r * r));
}

function buildElement(spec: ElementSpec, glass: THREE.Material, edge: THREE.Material) {
  const steps = 28;
  const front: THREE.Vector2[] = [];
  const back: THREE.Vector2[] = [];
  const xv1 = spec.x + spec.t / 2;
  const xv2 = spec.x - spec.t / 2;
  for (let i = 0; i <= steps; i++) {
    const r = (spec.h * i) / steps;
    front.push(new THREE.Vector2(r, sag(xv1, spec.r1, r)));
    back.push(new THREE.Vector2(r, sag(xv2, spec.r2, r)));
  }
  const surfaces = mergeGeometries([
    toAxis(new THREE.LatheGeometry(front, 72)),
    toAxis(new THREE.LatheGeometry(back.slice().reverse(), 72)),
  ]);
  const group = new THREE.Group();
  const lens = new THREE.Mesh(surfaces, glass);
  group.add(lens);
  const rim = latheEdge(
    [spec.h, back[steps].y],
    [spec.h, front[steps].y],
    false
  );
  group.add(new THREE.Mesh(rim, edge));
  return group;
}

export interface LensState {
  ring: number;
  aperture: number;
  explode: number;
}

export interface LensLabel {
  anchor: THREE.Object3D;
  title: string;
  note: string;
}

export class Lens {
  readonly root = new THREE.Group();
  /** Meshes that respond to focus-ring drags. */
  readonly grips: THREE.Object3D[] = [];
  readonly labels: LensLabel[] = [];

  private optics = new THREE.Group();
  private innerTube = new THREE.Group();
  private focusMaps: THREE.Texture[] = [];
  private knurl: THREE.Texture;
  private apertureMap: THREE.Texture;
  private iris: THREE.Mesh;
  private irisBlades: THREE.LineSegments;
  private lastPupil = -1;
  private exploding: { obj: THREE.Object3D; base: THREE.Vector3; offset: THREE.Vector3 }[] = [];
  private rubber: THREE.MeshStandardMaterial;

  readonly sensor: THREE.Mesh;

  constructor() {
    const anodized = new THREE.MeshPhysicalMaterial({
      color: 0x131315,
      roughness: 0.42,
      metalness: 0.55,
      clearcoat: 0.35,
      clearcoatRoughness: 0.4,
      side: THREE.DoubleSide,
    });
    const innerBlack = new THREE.MeshStandardMaterial({
      color: 0x060607,
      roughness: 0.95,
      side: THREE.DoubleSide,
    });
    const cap = new THREE.MeshStandardMaterial({
      color: 0x4a443c,
      roughness: 0.55,
      metalness: 0.5,
      side: THREE.DoubleSide,
    });
    const chrome = new THREE.MeshStandardMaterial({
      color: 0xd6d6db,
      roughness: 0.16,
      metalness: 1,
      side: THREE.DoubleSide,
    });
    const brass = new THREE.MeshStandardMaterial({ color: 0xb08a4a, roughness: 0.35, metalness: 1 });
    this.knurl = knurlTexture();
    this.rubber = new THREE.MeshStandardMaterial({
      color: 0x0d0d0e,
      roughness: 0.82,
      bumpMap: this.knurl,
      bumpScale: 3,
      side: THREE.DoubleSide,
    });

    // --- Sensor on its bench carrier -------------------------------------
    const sensorW = SENSOR_W * LENS_SCALE;
    const sensorH = SENSOR_H * LENS_SCALE;
    const sensorGroup = new THREE.Group();
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, sensorH + 0.16, sensorW + 0.16),
      new THREE.MeshStandardMaterial({ color: 0x1d2320, roughness: 0.45, metalness: 0.5 })
    );
    board.position.set(SENSOR_X - 0.025, AXIS_Y, 0);
    // Heat-sink fins on the back of the sensor board.
    const finMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3f, roughness: 0.35, metalness: 0.9 });
    for (let i = 0; i < 7; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, sensorH * 0.8, 0.012), finMat);
      fin.position.set(SENSOR_X - 0.09, AXIS_Y, (i - 3) * 0.07);
      fin.castShadow = true;
      sensorGroup.add(fin);
    }
    board.castShadow = true;
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, sensorH + 0.08, sensorW + 0.08),
      new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.3, metalness: 0.8 })
    );
    frame.position.set(SENSOR_X - 0.005, AXIS_Y, 0);
    const sensorGeo = new THREE.PlaneGeometry(sensorW, sensorH);
    // The image on a sensor is upside down.
    const uv = sensorGeo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
    sensorGeo.rotateY(Math.PI / 2);
    this.sensor = new THREE.Mesh(
      sensorGeo,
      new THREE.MeshBasicMaterial({ color: 0x222226, toneMapped: false })
    );
    this.sensor.position.set(SENSOR_X + 0.002, AXIS_Y, 0);
    sensorGroup.add(board, frame, this.sensor, this.post(SENSOR_X - 0.03, chrome));
    this.root.add(sensorGroup);
    this.addExplode(sensorGroup, new THREE.Vector3(-0.45, 0, 0));
    this.label(sensorGroup, new THREE.Vector3(SENSOR_X, AXIS_Y + sensorH / 2 + 0.2, 0), 'Sensor', '36 × 24 mm');

    // --- Fixed barrel ------------------------------------------------------
    const mount = barrelRing({ r0: 0.3, r1: 0.4, x0: 0.14, x1: 0.22, outer: chrome, cap });
    for (let i = 0; i < 3; i++) {
      const tab = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.06, 0.14),
        chrome
      );
      const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
      tab.position.set(0.155, -Math.sin(a) * 0.42, Math.cos(a) * 0.42);
      tab.rotation.x = a + Math.PI / 2;
      mount.add(tab);
    }
    mount.position.y = AXIS_Y;
    this.root.add(mount);
    this.addExplode(mount, new THREE.Vector3(-0.3, 0.55, 0));
    this.label(mount, new THREE.Vector3(0.18, AXIS_Y + 0.5, 0), 'Mount', 'bayonet');

    const rear = barrelRing({ r0: 0.37, r1: 0.415, x0: 0.22, x1: 0.6, outer: anodized, body: innerBlack, cap });
    rear.position.y = AXIS_Y;
    this.root.add(rear);
    this.addExplode(rear, new THREE.Vector3(-0.18, 0.95, 0));

    this.apertureMap = apertureScaleTexture((n) => (INDEX_U + apertureU(n) * APERTURE_SPAN) * Math.PI * 2);
    this.apertureMap.wrapS = THREE.RepeatWrapping;
    const apRing = barrelRing({
      r0: 0.38,
      r1: 0.435,
      x0: 0.6,
      x1: 0.74,
      outer: new THREE.MeshStandardMaterial({
        map: this.apertureMap,
        roughness: 0.5,
        metalness: 0.4,
        side: THREE.DoubleSide,
      }),
      body: innerBlack,
      cap,
    });
    apRing.position.y = AXIS_Y;
    this.root.add(apRing);
    this.addExplode(apRing, new THREE.Vector3(-0.05, 0.95, 0));
    this.label(apRing, new THREE.Vector3(0.67, AXIS_Y + 0.52, 0), 'Aperture ring', 'f/2 – f/16');

    const indexBand = barrelRing({ r0: 0.39, r1: 0.44, x0: 0.74, x1: 0.8, outer: anodized, body: innerBlack, cap });
    const indexMark = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.004, 0.008),
      new THREE.MeshBasicMaterial({ color: 0xff5a1f })
    );
    indexMark.position.set(0.77, 0.441, 0);
    indexBand.add(indexMark);
    indexBand.position.y = AXIS_Y;
    this.root.add(indexBand);
    this.addExplode(indexBand, new THREE.Vector3(0.05, 0.95, 0));

    // Focus ring: printed distance scale + rubber grip. It "rotates" by
    // scrolling its textures so the cutaway always faces the camera.
    const scaleMap = focusScaleTexture(FOCUS_SWEEP);
    scaleMap.wrapS = THREE.RepeatWrapping;
    this.focusMaps.push(scaleMap);
    const focusRing = new THREE.Group();
    const scaleBand = barrelRing({
      r0: 0.4,
      r1: 0.455,
      x0: 0.8,
      x1: 0.88,
      outer: new THREE.MeshStandardMaterial({
        map: scaleMap,
        roughness: 0.45,
        metalness: 0.3,
        side: THREE.DoubleSide,
      }),
      body: innerBlack,
      cap,
    });
    // Rubber grip with raised ribs at both ends.
    const grip = barrelRing({ r0: 0.4, r1: 0.478, x0: 0.9, x1: 1.2, outer: this.rubber, body: innerBlack, cap });
    const gripLipA = barrelRing({ r0: 0.4, r1: 0.466, x0: 0.88, x1: 0.9, outer: anodized, cap });
    const gripLipB = barrelRing({ r0: 0.4, r1: 0.466, x0: 1.2, x1: 1.22, outer: anodized, cap });
    focusRing.add(scaleBand, grip, gripLipA, gripLipB);
    focusRing.position.y = AXIS_Y;
    this.root.add(focusRing);
    grip.traverse((o) => o instanceof THREE.Mesh && this.grips.push(o));
    this.addExplode(focusRing, new THREE.Vector3(0.28, 0.95, 0));
    this.label(focusRing, new THREE.Vector3(1.05, AXIS_Y + 0.56, 0), 'Focus ring', 'drives the helicoid');

    const front = barrelRing({ r0: 0.4, r1: 0.45, x0: 1.22, x1: 1.34, outer: anodized, body: innerBlack, cap });
    front.position.y = AXIS_Y;
    this.root.add(front);
    this.addExplode(front, new THREE.Vector3(0.5, 0.95, 0));

    // --- Moving optical block ------------------------------------------------
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xf2fbfc,
      roughness: 0.03,
      metalness: 0,
      transmission: 1,
      thickness: 0.12,
      ior: 1.52,
      iridescence: 0.55,
      iridescenceIOR: 1.35,
      iridescenceThicknessRange: [220, 420],
      specularIntensity: 1,
      envMapIntensity: 1.4,
      side: THREE.DoubleSide,
    });
    const edGlass = glass.clone();
    edGlass.color.set(0xd9f6ff);
    edGlass.attenuationColor.set(0x7fd4e6);
    edGlass.attenuationDistance = 0.6;
    const edge = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.9 });

    const block = new THREE.Group();
    this.optics.add(block);
    this.optics.position.y = AXIS_Y;
    this.root.add(this.optics);

    const spread = [0.62, 0.42, 0.24, -0.2, -0.38, -0.56];
    ELEMENTS.forEach((spec, i) => {
      const el = buildElement(spec, spec.ed ? edGlass : glass, edge);
      block.add(el);
      this.addExplode(el, new THREE.Vector3(spread[i], 0, 0));
      this.label(el, new THREE.Vector3(spec.x, spec.h + 0.12, 0), spec.name, spec.note);
    });

    // Iris diaphragm at the stop.
    const irisMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1d,
      roughness: 0.35,
      metalness: 0.85,
      side: THREE.DoubleSide,
    });
    this.iris = new THREE.Mesh(new THREE.BufferGeometry(), irisMat);
    this.irisBlades = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x5a5650 })
    );
    const irisGroup = new THREE.Group();
    irisGroup.position.x = STOP_X;
    irisGroup.add(this.iris, this.irisBlades);
    block.add(irisGroup);
    this.addExplode(irisGroup, new THREE.Vector3(0, 0, 0));
    this.label(irisGroup, new THREE.Vector3(0, 0.42, 0), 'Iris', '9 blades');

    // Element retainer tube with its helicoid thread, moving with the glass.
    const tube = barrelRing({ r0: 0.345, r1: 0.36, x0: 0.56, x1: 1.47, outer: innerBlack, cap });
    const helixPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 600; i++) {
      const a = i * 0.07;
      const x = 0.85 + (i / 600) * 0.45;
      helixPts.push(new THREE.Vector3(x, -Math.sin(a) * 0.365, Math.cos(a) * 0.365));
    }
    const helix = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helixPts), 800, 0.005, 5),
      brass
    );
    this.innerTube.add(tube, helix);
    // Name ring on the front of the inner tube.
    const nameRing = new THREE.Mesh(
      new THREE.RingGeometry(0.345, 0.4, 96).rotateY(Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: nameRingTexture(), roughness: 0.6, metalness: 0.3 })
    );
    nameRing.position.x = 1.47;
    this.innerTube.add(nameRing);
    const frontTube = barrelRing({ r0: 0.4, r1: 0.43, x0: 1.3, x1: 1.47, outer: anodized, body: innerBlack, cap });
    this.innerTube.add(frontTube);
    block.add(this.innerTube);
    this.addExplode(this.innerTube, new THREE.Vector3(0.2, -0.05, 1.2));
    this.label(this.innerTube, new THREE.Vector3(1.05, -0.45, 0), 'Helicoid', 'focusing group travel');

    // Carrier post under the lens.
    this.root.add(this.post(0.5, chrome));
  }

  private post(x: number, mat: THREE.Material) {
    const g = new THREE.Group();
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, AXIS_Y - 0.3, 24), mat);
    rod.position.set(x, (AXIS_Y - 0.3) / 2 + 0.06, 0);
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.06, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x1c1c1f, roughness: 0.5, metalness: 0.6 })
    );
    foot.position.set(x, 0.03 + 0.03, 0);
    rod.castShadow = foot.castShadow = true;
    g.add(rod, foot);
    return g;
  }

  private addExplode(obj: THREE.Object3D, offset: THREE.Vector3) {
    this.exploding.push({ obj, base: obj.position.clone(), offset });
  }

  private label(parent: THREE.Object3D, local: THREE.Vector3, title: string, note: string) {
    const anchor = new THREE.Object3D();
    anchor.position.copy(local);
    if (parent.position.y !== 0) anchor.position.y -= parent.position.y;
    parent.add(anchor);
    this.labels.push({ anchor, title, note });
  }

  /** Radius of the entrance pupil in scene units for f-number n. */
  static pupilRadius(n: number) {
    return (FOCAL / n / 2) * LENS_SCALE;
  }

  /** Scene-space travel of the focusing group for a ring position. */
  static travel(ring: number) {
    return ring * MAX_EXTENSION * EXTENSION_SCALE;
  }

  private buildIris(n: number) {
    const rp = Lens.pupilRadius(n) * 1.02;
    if (Math.abs(rp - this.lastPupil) < 1e-4) return;
    this.lastPupil = rp;
    const outer = 0.34;
    const blades = 9;
    // Blades rotate as they close, so the opening twists slightly.
    const twist = (1 - rp / 0.25) * 0.6;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i < blades; i++) {
      const a = (i / blades) * Math.PI * 2 + twist;
      pts.push(new THREE.Vector2(Math.cos(a) * rp, Math.sin(a) * rp));
    }
    hole.setFromPoints(pts);
    hole.closePath();
    shape.holes.push(hole);
    const g = new THREE.ShapeGeometry(shape, 48).rotateY(Math.PI / 2);
    this.iris.geometry.dispose();
    this.iris.geometry = g;

    // Blade edges: a curved seam from each corner of the opening to the rim.
    const seg: number[] = [];
    for (let i = 0; i < blades; i++) {
      const a0 = (i / blades) * Math.PI * 2 + twist;
      let prev = new THREE.Vector2(Math.cos(a0) * rp, Math.sin(a0) * rp);
      for (let k = 1; k <= 8; k++) {
        const f = k / 8;
        const r = rp + (outer - rp) * f;
        const a = a0 + f * 0.9;
        const p = new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r);
        seg.push(0.001, prev.y, -prev.x, 0.001, p.y, -p.x);
        prev = p;
      }
    }
    this.irisBlades.geometry.dispose();
    this.irisBlades.geometry = new THREE.BufferGeometry().setAttribute(
      'position',
      new THREE.Float32BufferAttribute(seg, 3)
    );
  }

  setSensorTexture(tex: THREE.Texture) {
    const m = this.sensor.material as THREE.MeshBasicMaterial;
    m.map = tex;
    m.color.set(0xffffff);
    m.needsUpdate = true;
  }

  setHover(on: boolean) {
    this.rubber.emissive.set(on ? 0x2a1206 : 0x000000);
  }

  update(state: LensState) {
    const ringU = (state.ring * FOCUS_SWEEP) / (Math.PI * 2);
    this.focusMaps.forEach((t) => (t.offset.x = ringU));
    this.knurl.offset.x = ringU * this.knurl.repeat.x;
    this.apertureMap.offset.x = apertureU(state.aperture) * APERTURE_SPAN;
    this.buildIris(state.aperture);

    const e = state.explode;
    const ease = e * e * (3 - 2 * e);
    for (const item of this.exploding) {
      item.obj.position.copy(item.base).addScaledVector(item.offset, ease);
    }
    // The helicoid moves the whole optical block forward to focus closer.
    this.optics.position.x = Lens.travel(state.ring);
  }
}
