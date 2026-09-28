import * as THREE from 'three';
import { TeapotGeometry } from 'three/addons/geometries/TeapotGeometry.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { AXIS_Y, DIORAMA_END, DIORAMA_X0, distanceToX } from './layout';
import { STOP_X } from './lens';
import { SUBJECTS, type Subject } from './subjects';
import {
  cardTexture,
  checkerTexture,
  chipEdgeTexture,
  chipFaceTexture,
  floorGridTexture,
  podiumTexture,
  railTexture,
  terminalTexture,
} from './textures';

export interface PlacedSubject {
  subject: Subject;
  group: THREE.Group;
  /** World point the ray fan starts from. */
  anchor: THREE.Vector3;
  /** Where the label floats. */
  labelAnchor: THREE.Object3D;
  pickables: THREE.Object3D[];
}

/** Lateral position of each subject as a fraction of the sensor's half-width. */
const FRAME_X = [-0.55, 0.5, -0.2, 0.26, -0.02];
/** Yaw toward the viewer; the sensor still sees each subject's front. */
const YAW = [0.35, 0.5, 0.45, 0.2, 0.55];
/** Subject height as a fraction of the frame height at its distance. */
const FRAME_FILL = [0.36, 0.31, 0.26, 0.21, 0.23];
const TAN_H = 18 / 50;
const TAN_V = 12 / 50;

const std = (color: number, roughness = 0.5, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

function shadows(o: THREE.Object3D) {
  o.traverse((c) => {
    if (c instanceof THREE.Mesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
  return o;
}

/** Normalise a model so it is exactly 1 unit tall, sitting on y = 0. */
function normalise(model: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const s = 1 / size.y;
  model.scale.multiplyScalar(s);
  const c = box.getCenter(new THREE.Vector3());
  model.position.set(-c.x * s, -box.min.y * s, -c.z * s);
  const wrap = new THREE.Group();
  wrap.add(model);
  return wrap;
}

function casino() {
  const g = new THREE.Group();
  const felt = new THREE.Mesh(
    new RoundedBoxGeometry(1.1, 0.04, 0.8, 4, 0.03),
    std(0x0f3a2a, 0.95)
  );
  felt.position.y = 0.02;
  g.add(felt);
  const colors: [string, number][] = [
    ['#c8321b', 11],
    ['#18181a', 7],
    ['#e6dccb', 9],
  ];
  colors.forEach(([c, n], i) => {
    const side = new THREE.MeshStandardMaterial({ map: chipEdgeTexture(c), roughness: 0.4 });
    const face = new THREE.MeshStandardMaterial({ map: chipFaceTexture(c), roughness: 0.4 });
    const geo = new THREE.CylinderGeometry(0.11, 0.11, 0.028, 40);
    for (let k = 0; k < n; k++) {
      const chip = new THREE.Mesh(geo, [side, face, face]);
      chip.position.set(-0.3 + i * 0.25 + Math.sin(k * 1.7) * 0.006, 0.054 + k * 0.029, -0.08 + i * 0.05);
      chip.rotation.y = k * 0.9;
      g.add(chip);
    }
  });
  const back = new THREE.MeshStandardMaterial({ color: 0x8a2a1a, roughness: 0.5 });
  const cards: [string, string, boolean, number, number, number][] = [
    ['A', '♠', false, 0.18, 0.2, -0.35],
    ['K', '♥', true, 0.34, 0.22, -0.1],
  ];
  cards.forEach(([rank, suit, red, x, z, rot]) => {
    const face = new THREE.MeshStandardMaterial({ map: cardTexture(rank, suit, red), roughness: 0.55 });
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.004, 0.34), [back, back, face, back, back, back]);
    card.position.set(x, 0.045, z);
    card.rotation.y = rot;
    g.add(card);
  });
  // One card propped against the black stack.
  const face = new THREE.MeshStandardMaterial({ map: cardTexture('Q', '♦', true), roughness: 0.55 });
  const lean = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.004, 0.34), [back, back, face, back, back, back]);
  lean.position.set(0.02, 0.2, 0.12);
  lean.rotation.set(-1.15, 0.25, 0);
  g.add(lean);
  return g;
}

function teapot() {
  const g = new THREE.Group();
  const geo = new TeapotGeometry(0.3, 12);
  const solid = new THREE.Mesh(
    geo,
    new THREE.MeshPhysicalMaterial({ color: 0x2d8fa6, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15 })
  );
  const wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(new TeapotGeometry(0.302, 6)),
    new THREE.LineBasicMaterial({ color: 0x9fe8f6, transparent: true, opacity: 0.35 })
  );
  solid.position.y = wire.position.y = 0.34;
  g.add(solid, wire);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.5, 0.05, 64), std(0x1d2a2e, 0.6, 0.3));
  plate.position.y = 0.025;
  g.add(plate);
  return g;
}

function podium() {
  const g = new THREE.Group();
  const body = std(0x1b1a18, 0.55, 0.2);
  const steps: [string, number, number][] = [
    ['2', -0.24, 0.26],
    ['1', 0, 0.38],
    ['3', 0.24, 0.18],
  ];
  for (const [label, x, h] of steps) {
    const face = new THREE.MeshStandardMaterial({ map: podiumTexture(label), roughness: 0.5 });
    // The label faces the lens (−x).
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.24, h, 0.24), [body, face, body, body, body, body]);
    box.position.set(0, h / 2, x);
    g.add(box);
  }
  const gold = new THREE.MeshStandardMaterial({ color: 0xe9b65b, roughness: 0.22, metalness: 1 });
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.035, 0.1, 32), gold);
  cup.position.set(0, 0.47, 0);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 12), gold);
  stem.position.set(0, 0.405, 0);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.02, 24), gold);
  base.position.set(0, 0.39, 0);
  g.add(cup, stem, base);
  // Rating history as a small bar chart behind the podium.
  for (let i = 0; i < 9; i++) {
    const h = 0.12 + Math.abs(Math.sin(i * 1.3 + 0.4)) * 0.34 + i * 0.03;
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, h, 0.035),
      i === 8 ? gold : std(0x3a352c, 0.6, 0.3)
    );
    bar.position.set(0.3, h / 2, -0.32 + i * 0.08);
    g.add(bar);
  }
  return g;
}

function raytraced() {
  const g = new THREE.Group();
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.03, 1.1),
    new THREE.MeshStandardMaterial({ map: checkerTexture(), roughness: 0.35 })
  );
  floor.position.y = 0.015;
  g.add(floor);
  const spheres: [number, number, number, THREE.Material][] = [
    [0.2, -0.05, -0.05, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.02, metalness: 1 })],
    [0.14, -0.28, 0.3, new THREE.MeshPhysicalMaterial({ color: 0xc8321b, roughness: 0.15, clearcoat: 1 })],
    [0.11, 0.25, 0.26, std(0xe8e2d8, 0.9)],
    [0.08, 0.28, -0.32, new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, roughness: 0.02, thickness: 0.2, ior: 1.5 })],
  ];
  for (const [r, x, z, m] of spheres) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 32), m);
    s.position.set(x, 0.03 + r, z);
    g.add(s);
  }
  return g;
}

function terminal() {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.62, 0.82, 6, 0.05), std(0x6f685d, 0.75));
  shell.position.set(0.06, 0.52, 0);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, 0.52).rotateY(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: terminalTexture(), toneMapped: false })
  );
  screen.position.set(-0.192, 0.54, 0);
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.56, 0.76), std(0x1a1a18, 0.8));
  bezel.position.set(-0.2, 0.54, 0);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.14, 24), std(0x5f594f, 0.75));
  neck.position.set(0.06, 0.15, 0);
  const foot = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.08, 0.6, 4, 0.03), std(0x5f594f, 0.75));
  foot.position.set(0.06, 0.04, 0);
  const keyboard = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.035, 0.62, 3, 0.012), std(0x6f685d, 0.75));
  keyboard.position.set(-0.36, 0.018, 0);
  keyboard.rotation.z = 0.08;
  g.add(shell, bezel, screen, neck, foot, keyboard);
  const glow = new THREE.PointLight(0x9be37a, 1.2, 2.2, 2);
  glow.position.set(-0.5, 0.55, 0);
  g.add(glow);
  return g;
}

const BUILDERS: Record<string, () => THREE.Object3D> = {
  transcendence: casino,
  'go-renderer': teapot,
  elo: podium,
  minirt: raytraced,
  minishell: terminal,
};

export class Diorama {
  readonly root = new THREE.Group();
  readonly subjects: PlacedSubject[] = [];

  constructor() {
    this.buildBench();
    SUBJECTS.forEach((subject, i) => this.place(subject, i));
  }

  private buildBench() {
    const grid = floorGridTexture();
    grid.repeat.set(30, 20);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 40).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: grid, roughness: 0.92, metalness: 0 })
    );
    floor.position.set(10, 0, 0);
    floor.receiveShadow = true;
    this.root.add(floor);

    // Optical bench rail under sensor and lens, then a printed distance rule.
    const railMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1d, roughness: 0.35, metalness: 0.8 });
    const rail = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.2), railMat);
    rail.position.set(0.4, 0.03, 0);
    rail.castShadow = rail.receiveShadow = true;
    this.root.add(rail);

    const x0 = DIORAMA_X0 - 0.3;
    const x1 = DIORAMA_END;
    const marks = [450, 500, 600, 700, 800, 1000, 1500, 2000, 3000, 5000, 7000, 10000].map((d) => ({
      x: distanceToX(d),
      label: d >= 1000 ? `${d / 1000} m` : `.${String(d / 10).padStart(2, '0')}`,
    }));
    const rule = new THREE.Mesh(
      new THREE.PlaneGeometry(x1 - x0, 0.16).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: railTexture(marks, x0, x1), roughness: 0.8 })
    );
    rule.position.set((x0 + x1) / 2, 0.003, 0);
    rule.receiveShadow = true;
    this.root.add(rule);

    // Photo-studio sweep behind the far end: gives the sensor a soft backdrop.
    const sweepR = 1.6;
    const wallH = 7;
    const cove = new THREE.PlaneGeometry(24, wallH + sweepR * 2, 1, 48);
    const pos = cove.getAttribute('position');
    const len = wallH + (Math.PI / 2) * sweepR;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getX(i);
      // Arc length from the floor edge up the wall.
      const t = ((pos.getY(i) + (wallH + sweepR * 2) / 2) / (wallH + sweepR * 2)) * len;
      let x: number;
      let y: number;
      if (t < (Math.PI / 2) * sweepR) {
        const a = t / sweepR;
        x = Math.sin(a) * sweepR;
        y = sweepR - Math.cos(a) * sweepR;
      } else {
        x = sweepR;
        y = sweepR + (t - (Math.PI / 2) * sweepR);
      }
      pos.setXYZ(i, x, y, z);
    }
    cove.computeVertexNormals();
    const backdrop = new THREE.Mesh(
      cove,
      new THREE.MeshStandardMaterial({ color: 0x1a1a1d, roughness: 0.95, side: THREE.DoubleSide })
    );
    backdrop.position.set(DIORAMA_END + 0.4, 0.001, 0);
    backdrop.receiveShadow = true;
    this.root.add(backdrop);
  }

  private place(subject: Subject, i: number) {
    const x = distanceToX(subject.distance);
    const depth = x - STOP_X;
    const size = FRAME_FILL[i] * depth * TAN_V * 2;
    const z = FRAME_X[i] * depth * TAN_H;
    // Centre the subject a little below the optical axis; far ones sit on the floor.
    const centreY = AXIS_Y - depth * TAN_V * 0.28;
    const plinthH = Math.max(0, centreY - size / 2);

    const group = new THREE.Group();
    group.position.set(x, 0, z);

    if (plinthH > 0.02) {
      const plinth = new THREE.Mesh(
        new RoundedBoxGeometry(size * 1.05, plinthH, size * 1.05, 3, Math.min(0.02, plinthH / 4)),
        std(0x19191c, 0.75, 0.1)
      );
      plinth.position.y = plinthH / 2;
      group.add(plinth);
    }

    const model = normalise(BUILDERS[subject.id]());
    model.scale.setScalar(size);
    model.rotation.y = YAW[i];
    model.position.y = plinthH;
    group.add(model);
    shadows(group);
    this.root.add(group);

    const labelAnchor = new THREE.Object3D();
    labelAnchor.position.set(0, plinthH + size * 1.08, 0);
    group.add(labelAnchor);

    const anchor = new THREE.Vector3(x, plinthH + size * 0.55, z);
    const pickables: THREE.Object3D[] = [];
    model.traverse((o) => {
      if (o instanceof THREE.Mesh) pickables.push(o);
    });
    this.subjects.push({ subject, group, anchor, labelAnchor, pickables });
  }
}
