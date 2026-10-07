import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Glossy cream-pearl letters that fly through the page. Each one is a thick
// rounded tube bent into a glyph, so it reads like an inflated, extruded
// letter with soft speculars. One letter per section; scroll progress
// through that section drives its entry, drift, spin and exit.

export type Glyph = 'N' | 'W' | 'O' | 'C' | 'S';

const TUBE = 0.15;
const FOV = 30;
const DIST = 10;

const v = (x: number, y: number) => new THREE.Vector3(x, y, 0);

/** A polyline with rounded (filleted) corners as a curve path. */
function rounded(points: THREE.Vector3[], r: number) {
  const path = new THREE.CurvePath<THREE.Vector3>();
  let start = points[0].clone();
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const a = points[i - 1].clone().sub(p).normalize().multiplyScalar(r);
    const b = points[i + 1].clone().sub(p).normalize().multiplyScalar(r);
    const inPt = p.clone().add(a);
    const outPt = p.clone().add(b);
    path.add(new THREE.LineCurve3(start, inPt));
    path.add(new THREE.QuadraticBezierCurve3(inPt, p.clone(), outPt));
    start = outPt;
  }
  path.add(new THREE.LineCurve3(start, points[points.length - 1].clone()));
  return path;
}

function tubeGlyph(curve: THREE.Curve<THREE.Vector3>, segments = 260) {
  const parts: THREE.BufferGeometry[] = [new THREE.TubeGeometry(curve, segments, TUBE, 32, false)];
  for (const t of [0, 1]) {
    const cap = new THREE.SphereGeometry(TUBE, 32, 16);
    const p = curve.getPoint(t);
    cap.translate(p.x, p.y, p.z);
    parts.push(cap);
  }
  return parts;
}

function buildGlyph(g: Glyph): THREE.BufferGeometry[] {
  switch (g) {
    case 'N':
      return tubeGlyph(rounded([v(-0.36, -0.5), v(-0.36, 0.5), v(0.36, -0.5), v(0.36, 0.5)], 0.12));
    case 'W':
      return tubeGlyph(rounded([v(-0.62, 0.5), v(-0.31, -0.5), v(0, 0.3), v(0.31, -0.5), v(0.62, 0.5)], 0.11));
    case 'S':
      return tubeGlyph(
        new THREE.CatmullRomCurve3([
          v(0.36, 0.34), v(0.18, 0.49), v(-0.16, 0.5), v(-0.37, 0.3), v(-0.26, 0.06), v(0, 0),
          v(0.26, -0.06), v(0.37, -0.3), v(0.16, -0.5), v(-0.18, -0.49), v(-0.36, -0.34),
        ], false, 'centripetal')
      );
    case 'O':
      return [new THREE.TorusGeometry(0.4, TUBE, 32, 120)];
    case 'C': {
      const gap = Math.PI * 0.5;
      const torus = new THREE.TorusGeometry(0.4, TUBE, 32, 120, Math.PI * 2 - gap);
      torus.rotateZ(gap / 2);
      const caps = [gap / 2, -gap / 2].map((a) => {
        const s = new THREE.SphereGeometry(TUBE, 32, 16);
        s.translate(Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0);
        return s;
      });
      return [torus, ...caps];
    }
  }
}

export interface LetterCue {
  glyph: Glyph;
  /** Enter from this side (1 = right, -1 = left); exits on the other. */
  side: 1 | -1;
  /** Resting position in normalised screen space (-1..1). */
  x: number;
  y: number;
  /** Height as a fraction of the viewport. */
  size: number;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class Letters {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
  private items: { cue: LetterCue; mesh: THREE.Group; p: number }[] = [];
  private mouse = new THREE.Vector2();
  private reduced: boolean;

  constructor(canvas: HTMLCanvasElement, reduced: boolean) {
    this.reduced = reduced;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(-2, 4, 6);
    this.scene.add(key, new THREE.HemisphereLight(0xfff8e6, 0x9fb0d6, 0.9));
    this.camera.position.z = DIST;
    window.addEventListener('pointermove', (e) => this.mouse.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1));
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private material() {
    // Pearl: warm cream base, soft clearcoat, a navy-blue sheen in the shadows.
    return new THREE.MeshPhysicalMaterial({
      color: 0xfffaf0,
      roughness: 0.22,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      sheen: 0.8,
      sheenRoughness: 0.4,
      sheenColor: new THREE.Color(0x9fb0d6),
      iridescence: 0.12,
      iridescenceIOR: 1.3,
      envMapIntensity: 1.15,
    });
  }

  add(cue: LetterCue) {
    const group = new THREE.Group();
    const mat = this.material();
    for (const g of buildGlyph(cue.glyph)) group.add(new THREE.Mesh(g, mat));
    group.visible = false;
    this.scene.add(group);
    const item = { cue, mesh: group, p: 0 };
    this.items.push(item);
    return (p: number) => (item.p = p);
  }

  resize() {
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  /** True when any letter is on screen (render can be skipped otherwise). */
  get active() {
    return this.items.some((i) => i.p > 0 && i.p < 1);
  }

  render(t: number) {
    const halfH = DIST * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const halfW = halfH * this.camera.aspect;
    this.camera.position.x += (this.mouse.x * 0.25 - this.camera.position.x) * 0.05;
    this.camera.position.y += (-this.mouse.y * 0.18 - this.camera.position.y) * 0.05;
    this.camera.lookAt(0, 0, 0);

    for (const { cue, mesh, p } of this.items) {
      mesh.visible = p > 0 && p < 1;
      if (!mesh.visible) continue;
      const enter = this.reduced ? 1 : smooth(0, 0.3, p);
      const exit = this.reduced ? 0 : smooth(0.72, 1, p);
      const offX = cue.side * 1.45;
      const nx = THREE.MathUtils.lerp(THREE.MathUtils.lerp(offX, cue.x, enter), -offX, exit);
      const float = this.reduced ? 0 : Math.sin((t / 4) * Math.PI * 2 + cue.x * 3) * 0.025;
      const ny = cue.y + float + (p - 0.5) * 0.12;
      mesh.position.set(nx * halfW, ny * halfH, 0);
      // Sized against the viewport height; tall phone screens get smaller letters.
      const fit = Math.min(1, this.camera.aspect * 1.05);
      const s = cue.size * fit * 2 * halfH * (0.6 + 0.4 * enter) * (1 - 0.4 * exit);
      mesh.scale.setScalar(s);
      if (this.reduced) {
        mesh.rotation.set(0.2, -0.4, 0);
      } else {
        mesh.rotation.y = p * Math.PI * 1.6 * cue.side + Math.sin(t * 0.6) * 0.08;
        mesh.rotation.z = (enter - exit) * 0.32 * cue.side * (1 - p) + exit * Math.PI * 0.5 * cue.side;
        mesh.rotation.x = 0.25 + Math.sin(t * 0.5) * 0.06;
      }
    }
    this.renderer.render(this.scene, this.camera);
  }
}
