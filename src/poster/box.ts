import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// The hero billboard: a poster-covered box with a rounded dark-metal top.
// Scroll progress (0..1) swings the right face in, then the camera moves
// over the box until one flat poster face fills the viewport.

const W = 2.2; // face width
const H = 3.0; // face height
const D = 2.2; // depth
const FOV = 30;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class PosterBox {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  private box = new THREE.Group();
  private maps: THREE.Texture[] = [];
  private base = { d: 11, y: 0 };
  private mouse = new THREE.Vector2();
  private tilt = new THREE.Vector2();
  /** Hero scroll progress, written by the scroll timeline. */
  progress = 0;
  visible = true;

  constructor(private canvas: HTMLCanvasElement, private stage: HTMLElement, posters: HTMLCanvasElement[]) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.55;
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-3, 5, 6);
    this.scene.add(key, new THREE.HemisphereLight(0xfff8e6, 0xb8c2dc, 1.1));

    // Poster faces: front, right, back, left.
    const faces = posters.map((c) => {
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      // Barely zoomed: the words keep their full width, with just enough
      // headroom to slide up a little (parallax) without being cropped.
      tex.repeat.set(0.96, 0.96);
      tex.offset.set(0.02, 0.04);
      this.maps.push(tex);
      return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0, bumpMap: tex, bumpScale: 0.6 });
    });
    // Rounded top edge in the palette's dark navy metal.
    const dark = new THREE.MeshStandardMaterial({ color: 0x0d1c42, roughness: 0.35, metalness: 0.75 });
    // BoxGeometry material order: +x, -x, +y, -y, +z, -z.
    const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [faces[1], faces[3], dark, dark, faces[0], faces[2]]);
    const top = new THREE.Mesh(new RoundedBoxGeometry(W + 0.16, 0.18, D + 0.16, 5, 0.08), dark);
    top.position.y = H / 2 + 0.07;
    const foot = new THREE.Mesh(new RoundedBoxGeometry(W + 0.08, 0.08, D + 0.08, 3, 0.03), dark);
    foot.position.y = -H / 2 - 0.03;
    this.box.add(body, top, foot);
    this.scene.add(this.box);

    window.addEventListener('pointermove', (e) => {
      this.mouse.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    });
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = innerWidth;
    const h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // Fit the box into the hero stage element.
    // The hero sits at the top of the page, so offsets are viewport offsets.
    // Leave room for the info card under the box on narrow screens.
    const sh = Math.max(160, this.stage.offsetHeight) * (w < 760 ? 0.7 : 0.94);
    const visH = (H + 0.3) / (sh / h);
    this.base.d = visH / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2))) + D / 2;
    const cy = this.stage.offsetTop + this.stage.offsetHeight * (w < 760 ? 0.4 : 0.5);
    const ndc = 1 - (2 * cy) / h;
    this.base.y = ndc * (visH / 2);
  }

  update() {
    const p = this.progress;
    const a = smooth(0, 0.35, p);
    // The dive finishes at 80% so the flat poster holds before the wall arrives.
    const b = smooth(0.25, 0.8, p);
    // Swing the right face into view, then all the way to the front.
    this.box.rotation.y = lerp(0, -0.62, a) + (-Math.PI / 2 + 0.62) * b;
    this.box.position.y = lerp(this.base.y, 0, b);

    // Camera ends up square in front of the right face, filling the screen.
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    // Fit the whole face (contain, not cover) so no poster word is cut off.
    const fill = Math.max(H * 1.24, (W * 1.24) / this.camera.aspect) / (2 * tan) + W / 2;
    const d = lerp(this.base.d, fill, b);
    const lift = Math.sin(b * Math.PI) * 1.3;
    this.tilt.lerp(this.mouse, 0.05);
    const tx = this.tilt.x * 0.055 * (1 - b);
    const ty = this.tilt.y * 0.035 * (1 - b);
    // The camera stays on the page axis; the box starts low and rises to it.
    // Aim slightly high at the end so the poster centres below the header.
    const aim = 0.12 * b;
    this.camera.position.set(Math.sin(tx) * d, aim + lift - Math.sin(ty) * d * 0.5, Math.cos(tx) * d);
    this.camera.lookAt(0, aim, 0);

    // Poster words slide up at different speeds per face.
    const speeds = [0.03, 0.04, 0.035, 0.025];
    this.maps.forEach((m, i) => {
      m.offset.y = 0.04 - p * speeds[i];
    });
  }

  render() {
    if (!this.visible) return;
    this.update();
    this.renderer.render(this.scene, this.camera);
  }

  get element() {
    return this.canvas;
  }
}
