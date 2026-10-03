import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { LAYERS, formatLatency, type LayerKey } from './layers';
import { casino, normalise, podium, raytraced, shadows, std, teapot, terminal } from './models';
import { labelTexture, plateTexture } from './textures';

/** Vertical distance between two layer plates. */
export const SPACING = 4.2;
const PLATE_W = 7.6;
const PLATE_D = 4.8;
const BUS_X = -4.15;
const BUS_Z = -2.05;

export const layerY = (i: number) => -i * SPACING;

const glow = (color: number, opacity = 1) =>
  new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, toneMapped: false });

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Deterministic pseudo-random numbers so the scene looks the same on every visit. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

interface Animated {
  update(t: number, dt: number): void;
}

export interface LayerView {
  group: THREE.Group;
  labelAnchor: THREE.Object3D;
  /** Where the request packet stops on this layer (world space). */
  hub: THREE.Vector3;
  pickables: THREE.Object3D[];
}

export interface TraceStage {
  layer: number;
  /** Seconds the packet dwells at this stop. */
  dwell: number;
}

export class Machine {
  readonly root = new THREE.Group();
  readonly layers: LayerView[] = [];
  private animated: Animated[] = [];

  /** Cache hit rate, read by the cache-line animation. */
  hitRate = 0.9;
  /** SIMD width, read by the core-lane animation. */
  simd = 8;

  private packet: THREE.Mesh;
  private trail: THREE.Line;
  private trailPts: THREE.Vector3[] = [];
  private path: { pts: THREE.Vector3[]; stops: { at: number; stage: number }[] } | null = null;
  private pathT = 0;
  private dwell = 0;
  private stages: TraceStage[] = [];
  private onStage: ((i: number) => void) | null = null;
  private onDone: (() => void) | null = null;

  constructor() {
    LAYERS.forEach((layer, i) => this.buildLayer(layer.key, i));
    this.buildBus();

    this.packet = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), glow(0xffd2b8));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 16), glow(0xff7a3d, 0.25));
    this.packet.add(halo);
    this.packet.visible = false;
    const trailGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(64 * 3), 3));
    this.trail = new THREE.Line(
      trailGeo,
      new THREE.LineBasicMaterial({ color: 0xff7a3d, transparent: true, opacity: 0.7, toneMapped: false })
    );
    this.trail.frustumCulled = false;
    this.trail.visible = false;
    this.root.add(this.packet, this.trail);
  }

  // --- Layers ------------------------------------------------------------------

  private buildLayer(key: LayerKey, i: number) {
    const layer = LAYERS[i];
    const group = new THREE.Group();
    group.position.y = layerY(i);
    this.root.add(group);

    const plate = new THREE.Mesh(
      new RoundedBoxGeometry(PLATE_W, 0.14, PLATE_D, 3, 0.05),
      new THREE.MeshPhysicalMaterial({
        color: 0x131316,
        roughness: 0.55,
        metalness: 0.35,
        clearcoat: 0.15,
        clearcoatRoughness: 0.6,
      })
    );
    plate.position.y = -0.07;
    plate.receiveShadow = true;
    group.add(plate);

    // A lit edge in the layer's colour and its etched name along the front.
    const edge = new THREE.Mesh(new THREE.BoxGeometry(PLATE_W - 0.1, 0.015, 0.015), glow(layer.color));
    edge.position.set(0, 0.002, PLATE_D / 2 - 0.02);
    group.add(edge);
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(PLATE_W - 0.3, 0.32).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({
        map: plateTexture(layer.code, layer.name, formatLatency(layer.latency), hex(layer.color)),
        roughness: 0.7,
      })
    );
    strip.position.set(0, 0.004, PLATE_D / 2 - 0.26);
    group.add(strip);

    const hub = new THREE.Vector3();
    const machinery = new THREE.Group();
    group.add(machinery);
    switch (key) {
      case 'net':
        hub.copy(this.network(machinery, layer.color));
        break;
      case 'os':
        hub.copy(this.processes(machinery, layer.color));
        break;
      case 'ram':
        hub.copy(this.dram(machinery, layer.color));
        break;
      case 'cache':
        hub.copy(this.cacheLines(machinery));
        break;
      case 'core':
        hub.copy(this.core(machinery, layer.color));
        break;
    }
    hub.y += layerY(i);

    // The project that lives on this layer.
    const builders: Record<LayerKey, () => THREE.Object3D> = {
      net: casino,
      os: terminal,
      ram: podium,
      cache: teapot,
      core: raytraced,
    };
    const model = normalise(builders[key]());
    // normalise() makes models 1 unit tall; flat ones get very wide, so fit both ways.
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    model.scale.setScalar(Math.min(1.5, 2.5 / Math.max(size.x, size.z)));
    model.position.set(2.35, 0, -0.15);
    model.rotation.y = 0.45;
    shadows(model);
    group.add(model);

    const labelAnchor = new THREE.Object3D();
    labelAnchor.position.set(-PLATE_W / 2 + 0.2, 0.05, PLATE_D / 2);
    group.add(labelAnchor);

    const pickables: THREE.Object3D[] = [plate];
    model.traverse((o) => o instanceof THREE.Mesh && pickables.push(o));
    this.layers.push({ group, labelAnchor, hub, pickables });
  }

  /** NET: routers on a mesh of links, packets hopping between them. */
  private network(g: THREE.Group, color: number) {
    const rand = rng(42);
    const nodes: THREE.Vector3[] = [];
    while (nodes.length < 13) {
      const p = new THREE.Vector3(-3.3 + rand() * 4.1, 0, -1.9 + rand() * 3.4);
      if (nodes.every((n) => n.distanceTo(p) > 0.75)) nodes.push(p);
    }
    const pillar = new THREE.CylinderGeometry(0.035, 0.05, 0.3, 12);
    const head = new THREE.SphereGeometry(0.055, 16, 12);
    const pillarMat = std(0x2a2a2f, 0.4, 0.8);
    const headMat = glow(color);
    nodes.forEach((n) => {
      const p = new THREE.Mesh(pillar, pillarMat);
      p.position.set(n.x, 0.15, n.z);
      p.castShadow = true;
      const h = new THREE.Mesh(head, headMat);
      h.position.set(n.x, 0.33, n.z);
      g.add(p, h);
      n.y = 0.33;
    });

    // Link every node to its two nearest neighbours with an arc.
    const links: THREE.QuadraticBezierCurve3[] = [];
    const seen = new Set<string>();
    nodes.forEach((a, i) => {
      nodes
        .map((b, j) => ({ j, d: a.distanceTo(b) }))
        .filter((x) => x.j !== i)
        .sort((x, y) => x.d - y.d)
        .slice(0, 2)
        .forEach(({ j, d }) => {
          const k = i < j ? `${i}-${j}` : `${j}-${i}`;
          if (seen.has(k)) return;
          seen.add(k);
          const b = nodes[j];
          const mid = a.clone().add(b).multiplyScalar(0.5);
          mid.y += 0.25 + d * 0.22;
          links.push(new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone()));
        });
    });
    const linkMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.32 });
    links.forEach((c) => g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(c.getPoints(24)), linkMat)));

    const packetGeo = new THREE.SphereGeometry(0.045, 10, 8);
    const packetMat = glow(0xffd2b8);
    const packets = Array.from({ length: 18 }, (_, i) => {
      const m = new THREE.Mesh(packetGeo, packetMat);
      g.add(m);
      return { m, link: i % links.length, t: rand(), speed: 0.35 + rand() * 0.5, dir: rand() > 0.5 ? 1 : -1 };
    });
    this.animated.push({
      update: (_t, dt) => {
        for (const p of packets) {
          p.t += p.dir * p.speed * dt;
          if (p.t > 1 || p.t < 0) {
            p.link = Math.floor(rand() * links.length);
            p.t = p.dir > 0 ? 0 : 1;
          }
          links[p.link].getPoint(p.t, p.m.position);
        }
      },
    });
    const c = nodes.reduce((acc, n) => acc.add(n), new THREE.Vector3()).multiplyScalar(1 / nodes.length);
    return c.setY(0.45);
  }

  /** OS: a shell forking a pipeline (cat | grep | wc) inside a namespace. */
  private processes(g: THREE.Group, color: number) {
    const box = new RoundedBoxGeometry(0.95, 0.36, 0.62, 3, 0.05);
    const body = std(0x1b1d1b, 0.5, 0.3);
    const proc = (name: string, x: number, z: number, accent = false) => {
      const top = new THREE.MeshStandardMaterial({
        map: labelTexture(name, accent ? '#0b0b0c' : '#d8f5c8', accent ? hex(color) : '#141814'),
        roughness: 0.6,
      });
      const m = new THREE.Mesh(box, [body, body, top, body, body, body]);
      m.position.set(x, 0.18, z);
      m.castShadow = true;
      g.add(m);
      return m.position.clone().setY(0.36);
    };
    const sh = proc('sh · 1', -1.6, -1.35, true);
    const kids = [proc('cat', -3.0, 0.75), proc('grep', -1.6, 0.75), proc('wc', -0.2, 0.75)];

    // fork() edges from the shell to each child.
    const forkMat = new THREE.LineDashedMaterial({ color, dashSize: 0.08, gapSize: 0.06, transparent: true, opacity: 0.7 });
    kids.forEach((k) => {
      const mid = sh.clone().lerp(k, 0.5).setY(0.75);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(sh, mid, k).getPoints(20)),
        forkMat
      );
      line.computeLineDistances();
      g.add(line);
    });

    // Pipes between neighbours with bytes flowing through them.
    // Plain transparency: transmission would force a second scene render every frame.
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0xc8f0d0, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false });
    const byteGeo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
    const byteMat = glow(color);
    const bytes: { m: THREE.Mesh; a: THREE.Vector3; b: THREE.Vector3; t: number }[] = [];
    for (let i = 0; i < 2; i++) {
      const a = kids[i].clone().setY(0.2).setX(kids[i].x + 0.48);
      const b = kids[i + 1].clone().setY(0.2).setX(kids[i + 1].x - 0.48);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, b.x - a.x, 16, 1, true).rotateZ(Math.PI / 2), pipeMat);
      pipe.position.copy(a).lerp(b, 0.5);
      g.add(pipe);
      for (let k = 0; k < 4; k++) {
        const m = new THREE.Mesh(byteGeo, byteMat);
        g.add(m);
        bytes.push({ m, a, b, t: k / 4 });
      }
    }
    this.animated.push({
      update: (_t, dt) => {
        for (const b of bytes) {
          b.t = (b.t + dt * 0.45) % 1;
          b.m.position.lerpVectors(b.a, b.b, b.t);
        }
      },
    });

    // The namespace the pipeline runs in.
    const ns = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(4.3, 0.9, 1.5)),
      new THREE.LineDashedMaterial({ color, dashSize: 0.12, gapSize: 0.08, transparent: true, opacity: 0.45 })
    );
    ns.computeLineDistances();
    ns.position.set(-1.6, 0.45, 0.75);
    g.add(ns);
    return kids[0].clone().setY(0.55);
  }

  /** RAM: two DIMMs whose rows light up as they refresh. */
  private dram(g: THREE.Group, color: number) {
    const chips = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.07, 0.52), std(0xffffff, 0.45, 0.4), 16);
    const pcb = std(0x10261c, 0.6, 0.2);
    const gold = std(0xc9a24a, 0.3, 1);
    const m4 = new THREE.Matrix4();
    for (let d = 0; d < 2; d++) {
      const z = -0.9 + d * 1.6;
      const board = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.05, 0.95), pcb);
      board.position.set(-1.55, 0.025, z);
      board.receiveShadow = true;
      const contacts = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.052, 0.08), gold);
      contacts.position.set(-1.55, 0.026, z + 0.42);
      g.add(board, contacts);
      for (let c = 0; c < 8; c++) {
        m4.makeTranslation(-3.15 + c * 0.45, 0.085, z - 0.05);
        chips.setMatrixAt(d * 8 + c, m4);
      }
    }
    chips.castShadow = true;
    g.add(chips);
    const base = new THREE.Color(0x19191c);
    const hot = new THREE.Color(color);
    const tmp = new THREE.Color();
    this.animated.push({
      update: (t) => {
        for (let i = 0; i < 16; i++) {
          const phase = (t * 1.6 - (i % 8) * 0.35 - Math.floor(i / 8) * 1.4) % 2.8;
          const k = Math.max(0, 1 - Math.abs(phase - 0.3) * 3);
          chips.setColorAt(i, tmp.copy(base).lerp(hot, k * 0.85));
        }
        chips.instanceColor!.needsUpdate = true;
      },
    });
    return new THREE.Vector3(-1.55, 0.35, -0.1);
  }

  /** CACHE: 16 sets × 8 ways of 64-byte lines flashing hit or miss. */
  private cacheLines(g: THREE.Group) {
    const cols = 16;
    const rows = 8;
    const lines = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.06, 0.34), std(0xffffff, 0.4, 0.3), cols * rows);
    const m4 = new THREE.Matrix4();
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        m4.makeTranslation(-3.35 + c * 0.24, 0.03, -1.75 + r * 0.42);
        lines.setMatrixAt(r * cols + c, m4);
      }
    g.add(lines);
    const heat = new Float32Array(cols * rows);
    const kind = new Uint8Array(cols * rows);
    const base = new THREE.Color(0x1a1c20);
    const hit = new THREE.Color(0x6fd3e8);
    const miss = new THREE.Color(0xff5a1f);
    const tmp = new THREE.Color();
    let acc = 0;
    this.animated.push({
      update: (_t, dt) => {
        acc += dt * 28;
        while (acc > 1) {
          acc -= 1;
          const i = Math.floor(Math.random() * heat.length);
          heat[i] = 1;
          kind[i] = Math.random() < this.hitRate ? 0 : 1;
        }
        for (let i = 0; i < heat.length; i++) {
          heat[i] = Math.max(0, heat[i] - dt * 1.8);
          lines.setColorAt(i, tmp.copy(base).lerp(kind[i] ? miss : hit, heat[i]));
        }
        lines.instanceColor!.needsUpdate = true;
      },
    });
    return new THREE.Vector3(-1.55, 0.3, 0);
  }

  /** CORE: register file and ALU feeding eight SIMD lanes in lockstep. */
  private core(g: THREE.Group, color: number) {
    const block = (name: string, x: number, z: number, w: number) => {
      const top = new THREE.MeshStandardMaterial({ map: labelTexture(name, '#ece7df', '#1a1a1e'), roughness: 0.5 });
      const side = std(0x232328, 0.4, 0.6);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, 0.9), [side, side, top, side, side, side]);
      m.position.set(x, 0.11, z);
      m.castShadow = true;
      g.add(m);
    };
    block('REG', -3.05, -1.05, 0.9);
    block('ALU', -3.05, 0.25, 0.9);
    block('L1D', -3.05, 1.45, 0.9);

    const laneMat = std(0x1d1d22, 0.5, 0.5);
    const pulseMat = glow(0xfff1e0);
    const dimMat = glow(color, 0.18);
    const lanes: { pulse: THREE.Mesh; idle: THREE.Mesh }[] = [];
    for (let i = 0; i < 8; i++) {
      const z = -1.6 + i * 0.44;
      const lane = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.04, 0.2), laneMat);
      lane.position.set(-0.85, 0.02, z);
      lane.receiveShadow = true;
      const pulse = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.16), pulseMat);
      pulse.position.set(-2.4, 0.06, z);
      const idle = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.045, 0.2), dimMat);
      idle.position.copy(lane.position);
      g.add(lane, pulse, idle);
      lanes.push({ pulse, idle });
    }
    this.animated.push({
      update: (t) => {
        // All active lanes advance together: one instruction, many data.
        const x = -2.4 + ((t * 1.3) % 1) * 3.1;
        lanes.forEach((l, i) => {
          const on = i < this.simd;
          l.pulse.visible = on;
          l.idle.visible = !on;
          l.pulse.position.x = x;
        });
      },
    });
    return new THREE.Vector3(-3.05, 0.4, 0.25);
  }

  /** The vertical bus every request travels through. */
  private buildBus() {
    const top = 0.9;
    const bottom = layerY(LAYERS.length - 1) - 0.2;
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, top - bottom, 20, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.16, depthWrite: false })
    );
    tube.position.set(BUS_X, (top + bottom) / 2, BUS_Z);
    this.root.add(tube);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, top - bottom, 6), glow(0xff7a3d, 0.5));
    core.position.copy(tube.position);
    this.root.add(core);
    LAYERS.forEach((l, i) => {
      const via = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 8, 24).rotateX(Math.PI / 2), glow(l.color));
      via.position.set(BUS_X, layerY(i) + 0.02, BUS_Z);
      this.root.add(via);
    });
  }

  // --- Request trace ----------------------------------------------------------------

  /** Send a packet down the stack; `stages` lists the layers it stops at. */
  trace(stages: TraceStage[], onStage: (i: number) => void, onDone: () => void) {
    const pts: THREE.Vector3[] = [new THREE.Vector3(BUS_X, 1.6, BUS_Z)];
    const stops: { at: number; stage: number }[] = [];
    stages.forEach((s, k) => {
      const y = layerY(s.layer);
      const hub = this.layers[s.layer].hub;
      pts.push(new THREE.Vector3(BUS_X, y + 0.3, BUS_Z));
      pts.push(hub.clone());
      stops.push({ at: pts.length - 1, stage: k });
      pts.push(new THREE.Vector3(BUS_X, y + 0.3, BUS_Z));
    });
    pts.push(new THREE.Vector3(BUS_X, 1.6, BUS_Z));
    this.path = { pts, stops };
    this.stages = stages;
    this.pathT = 0;
    this.dwell = 0;
    this.onStage = onStage;
    this.onDone = onDone;
    this.packet.visible = this.trail.visible = true;
    this.packet.position.copy(pts[0]);
    this.trailPts = [];
  }

  get tracing() {
    return this.path !== null;
  }

  /** Current packet depth in layer units, for the camera to follow. */
  get packetDepth() {
    return Math.max(0, -this.packet.position.y / SPACING);
  }

  private stepTrace(dt: number) {
    const p = this.path;
    if (!p) return;
    if (this.dwell > 0) {
      this.dwell -= dt;
    } else {
      const seg = Math.floor(this.pathT);
      if (seg >= p.pts.length - 1) {
        this.path = null;
        this.packet.visible = this.trail.visible = false;
        this.onDone?.();
        return;
      }
      const a = p.pts[seg];
      const b = p.pts[seg + 1];
      const len = Math.max(0.05, a.distanceTo(b));
      this.pathT = Math.min(seg + 1, this.pathT + (dt * 7) / len);
      this.packet.position.lerpVectors(a, b, this.pathT - seg);
      if (this.pathT === seg + 1) {
        const stop = p.stops.find((s) => s.at === seg + 1);
        if (stop) {
          this.dwell = this.stages[stop.stage].dwell;
          this.onStage?.(stop.stage);
        }
      }
    }
    this.trailPts.push(this.packet.position.clone());
    if (this.trailPts.length > 64) this.trailPts.shift();
    const attr = this.trail.geometry.getAttribute('position') as THREE.BufferAttribute;
    this.trailPts.forEach((v, i) => attr.setXYZ(i, v.x, v.y, v.z));
    this.trail.geometry.setDrawRange(0, this.trailPts.length);
    attr.needsUpdate = true;
  }

  update(t: number, dt: number) {
    for (const a of this.animated) a.update(t, dt);
    this.stepTrace(dt);
    const s = 1 + Math.sin(t * 9) * 0.12;
    this.packet.scale.setScalar(s);
  }
}
