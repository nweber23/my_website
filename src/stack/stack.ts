import * as THREE from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  LAYERS,
  amat,
  cycles,
  formatLatency,
  humanScale,
  latencyAt,
  layerOf,
  simdName,
} from './layers';
import { Machine, SPACING, layerY, type TraceStage } from './machine';
import { Terminal } from './terminal';

const BG = 0x0b0b0c;
const MAX_DEPTH = LAYERS.length - 1;

function $(root: ParentNode, sel: string) {
  return root.querySelector<HTMLElement>(sel);
}

function el(tag: string, cls: string, html = '') {
  const e = document.createElement(tag);
  e.className = cls;
  e.innerHTML = html;
  return e;
}

const jitter = (base: number, lo: number, hi: number) => base * (lo + Math.random() * (hi - lo));

export class Stack {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
  private composer: EffectComposer;
  private bokeh: BokehPass;
  private labels = new CSS2DRenderer();
  private machine = new Machine();
  private key = new THREE.DirectionalLight(0xfff0dc, 2.2);
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2(9, 9);
  private parallax = new THREE.Vector2();
  private terminal: Terminal | null = null;

  private depth = 0;
  private depthTarget = 0;
  private depthRate = 6;
  private hitRate = 0.9;
  private simd = 8;
  private drag: { id: number; x: number; y: number; depth: number; moved: boolean } | null = null;
  private followPacket = false;
  private running = false;
  private last = performance.now();
  private clock = 0;
  private reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  private ui: {
    stage: HTMLElement;
    slider: HTMLInputElement;
    sliderOut: HTMLElement | null;
    readout: Record<string, HTMLElement>;
    card: Record<string, HTMLElement>;
    layerButtons: HTMLButtonElement[];
    hitButtons: HTMLButtonElement[];
    traceButton: HTMLButtonElement | null;
  };
  private tags: HTMLElement[] = [];
  private lastUI = '';

  constructor(private root: HTMLElement) {
    const stage = $(root, '[data-lab-stage]')!;
    const readout: Record<string, HTMLElement> = {};
    root.querySelectorAll<HTMLElement>('[data-r]').forEach((e) => (readout[e.dataset.r!] = e));
    const card: Record<string, HTMLElement> = {};
    root.querySelectorAll<HTMLElement>('[data-card] [class^="card__"]').forEach((e) => {
      const key = [...e.attributes].find((a) => a.name.startsWith('data-card-'))?.name.slice(10);
      if (key) card[key] = e;
    });
    card.root = $(root, '[data-card]')!;
    this.ui = {
      stage,
      slider: $(root, '[data-depth]') as HTMLInputElement,
      sliderOut: $(root, '[data-depth-out]'),
      readout,
      card,
      layerButtons: [...root.querySelectorAll<HTMLButtonElement>('[data-layer]')],
      hitButtons: [...root.querySelectorAll<HTMLButtonElement>('[data-hit]')],
      traceButton: $(root, '[data-trace]') as HTMLButtonElement | null,
    };

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    const canvas = this.renderer.domElement;
    canvas.className = 'lab__canvas';
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute(
      'aria-label',
      'Interactive machine stack. Arrow keys move between layers, 1 to 5 jump to a layer, T sends a request down the stack.'
    );
    canvas.style.touchAction = 'pan-y';
    stage.prepend(canvas);
    this.labels.domElement.className = 'lab__labels';
    stage.appendChild(this.labels.domElement);

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('pointerleave', () => this.parallax.set(0, 0));
    canvas.addEventListener('keydown', this.onKey);

    this.buildScene();

    this.composer = new EffectComposer(
      this.renderer,
      new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 })
    );
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bokeh = new BokehPass(this.scene, this.camera, { focus: 11, aperture: 0.0026, maxblur: 0.01 });
    this.composer.addPass(this.bokeh);
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.38, 0.5, 0.88));
    this.composer.addPass(new OutputPass());

    this.machine.layers.forEach((l, i) => {
      const layer = LAYERS[i];
      const b = el(
        'button',
        'tag3d',
        `<span class="tag3d__idx">${layer.code}</span><span class="tag3d__name">${layer.subject.short}</span><span class="tag3d__dist">${formatLatency(layer.latency)}</span>`
      );
      b.setAttribute('type', 'button');
      b.setAttribute('tabindex', '-1');
      b.addEventListener('click', () => this.goTo(i));
      l.labelAnchor.add(new CSS2DObject(b));
      this.tags.push(b);
    });

    const log = $(root, '[data-term-log]');
    const form = $(root, '[data-term-form]') as HTMLFormElement | null;
    const input = $(root, '[data-term-input]') as HTMLInputElement | null;
    if (log && form && input) {
      this.terminal = new Terminal(log, input, form, {
        goTo: (i) => this.goTo(i),
        trace: () => this.trace(),
        setHitRate: (h) => this.setHitRate(h),
        setSimd: (w) => (this.simd = this.machine.simd = w),
        open: (anchor) => document.getElementById(anchor)?.scrollIntoView({ behavior: this.reduceMotion ? 'auto' : 'smooth' }),
        hitRate: () => this.hitRate,
        simd: () => this.simd,
      });
    }

    this.bindUI();
    new ResizeObserver(() => this.resize()).observe(stage);
    this.resize();
    new IntersectionObserver(([entry]) => (entry.isIntersecting ? this.start() : (this.running = false))).observe(root);
    document.addEventListener('visibilitychange', () => (document.hidden ? (this.running = false) : this.start()));

    root.classList.add('is-live');
    // Opening move: one request, all the way down.
    if (!this.reduceMotion) window.setTimeout(() => this.trace(true), 900);
  }

  private buildScene() {
    const s = this.scene;
    s.background = new THREE.Color(BG);
    s.fog = new THREE.Fog(BG, 12, 30);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    s.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    s.environmentIntensity = 0.5;

    const k = this.key;
    k.castShadow = true;
    k.shadow.mapSize.set(2048, 2048);
    Object.assign(k.shadow.camera, { left: -5.5, right: 5.5, top: 5.5, bottom: -5.5, near: 0.5, far: 20 });
    k.shadow.bias = -0.0005;
    k.shadow.normalBias = 0.02;
    s.add(k, k.target);
    const rim = new THREE.DirectionalLight(0x9cc8ff, 1.0);
    rim.position.set(-8, 3, -6);
    s.add(rim, new THREE.HemisphereLight(0xb4c4d8, 0x0b0b0c, 0.4));

    // A soft pool of light over every plate.
    LAYERS.forEach((l, i) => {
      const spot = new THREE.SpotLight(0xfff3e6, 9, 0, 0.75, 0.8, 1.4);
      spot.position.set(0.5, layerY(i) + 3.4, 2.4);
      spot.target.position.set(0, layerY(i), 0);
      const tint = new THREE.PointLight(l.color, 1.6, 4.5, 2);
      tint.position.set(-1.5, layerY(i) + 0.9, 0.5);
      s.add(spot, spot.target, tint);
    });
    s.add(this.machine.root);
  }

  private bindUI() {
    const { slider, layerButtons, hitButtons, traceButton } = this.ui;
    slider.addEventListener('input', () => {
      this.followPacket = false;
      this.depthTarget = (Number(slider.value) / 1000) * MAX_DEPTH;
      this.depthRate = 12;
    });
    layerButtons.forEach((b) => b.addEventListener('click', () => this.goTo(Number(b.dataset.layer))));
    hitButtons.forEach((b) =>
      b.addEventListener('click', () => {
        const h = Number(b.dataset.hit);
        this.terminal?.echo(`hitrate ${Math.round(h * 100)}`);
        this.setHitRate(h);
      })
    );
    traceButton?.addEventListener('click', () => {
      this.terminal?.echo('trace');
      this.trace();
    });
    document.querySelectorAll<HTMLElement>('[data-rack]').forEach((b) =>
      b.addEventListener('click', () => {
        this.root.scrollIntoView({ behavior: this.reduceMotion ? 'auto' : 'smooth' });
        window.setTimeout(() => this.goTo(layerOf(Number(b.dataset.rack)), 3), this.reduceMotion ? 0 : 500);
      })
    );
    window.addEventListener('keydown', (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || !this.running) return;
      const t = e.target as HTMLElement;
      if (t !== document.body && !this.root.contains(t)) return;
      if (t instanceof HTMLInputElement || t === this.renderer.domElement) return;
      this.handleKey(e);
    });
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') this.nudge(0.25);
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') this.nudge(-0.25);
    else return this.handleKey(e);
    e.preventDefault();
  };

  private nudge(d: number) {
    this.followPacket = false;
    this.depthTarget = THREE.MathUtils.clamp(this.depthTarget + d, 0, MAX_DEPTH);
    this.depthRate = 10;
  }

  private handleKey(e: KeyboardEvent) {
    const k = e.key.toLowerCase();
    if (k >= '1' && k <= '5') this.goTo(Number(k) - 1);
    else if (k === 't') {
      this.terminal?.echo('trace');
      this.trace();
    } else return;
    e.preventDefault();
  }

  goTo(i: number, rate = 4) {
    this.followPacket = false;
    this.depthTarget = THREE.MathUtils.clamp(i, 0, MAX_DEPTH);
    this.depthRate = this.reduceMotion ? 60 : rate;
  }

  private setHitRate(h: number) {
    this.hitRate = this.machine.hitRate = h;
    this.ui.hitButtons.forEach((b) => b.setAttribute('aria-checked', String(Math.abs(Number(b.dataset.hit) - h) < 1e-3)));
    this.lastUI = '';
    this.terminal?.print(`<span class="t-dim">cache hit rate ${Math.round(h * 100)}% → AMAT ${formatLatency(amat(h))}</span>`);
  }

  /** Send a request down the stack, logging each hop with a plausible latency. */
  trace(auto = false) {
    if (this.machine.tracing) return;
    const hit = Math.random() < this.hitRate;
    const lines: [number, string, number][] = [
      [0, 'ws frame in · table#3 · fan-out to 4 tabs', jitter(LAYERS[0].latency, 0.8, 1.4)],
      [1, 'read(fd=7) → handler · pipe to engine', jitter(LAYERS[1].latency, 0.6, 1.5)],
    ];
    if (!hit) lines.push([2, 'L2 miss → DRAM row open, 64 B burst', jitter(LAYERS[2].latency, 0.9, 1.25)]);
    lines.push([3, hit ? 'L2 hit · line 0x7ffe…40' : 'line filled into L2', jitter(LAYERS[3].latency, 0.9, 1.2)]);
    lines.push([4, `${simdName(this.simd)} · ${this.simd} rays per instruction`, jitter(LAYERS[4].latency, 0.9, 1.1)]);

    const stages: TraceStage[] = lines.map(([layer]) => ({ layer, dwell: this.reduceMotion ? 0.05 : 0.55 }));
    if (!auto) this.terminal?.print('<span class="t-dim">tracing one request…</span>');
    this.followPacket = true;
    this.ui.traceButton?.setAttribute('aria-busy', 'true');
    const total = lines.reduce((s, l) => s + l[2], 0);
    this.machine.trace(
      stages,
      (i) => {
        const [layer, msg, ns] = lines[i];
        const l = LAYERS[layer];
        this.terminal?.print(
          `<span class="t-hop" style="--c:#${l.color.toString(16).padStart(6, '0')}">${l.code.padEnd(4)}</span> ${msg} <span class="t-time">${formatLatency(ns)}</span>`
        );
      },
      () => {
        this.followPacket = false;
        this.ui.traceButton?.removeAttribute('aria-busy');
        this.terminal?.print(
          `<span class="t-dim">← reply · total ${formatLatency(total)} · ${((lines[0][2] / total) * 100).toFixed(1)}% of it on the wire</span>`
        );
        if (auto) window.setTimeout(() => this.goTo(0, 1.6), 600);
      }
    );
  }

  // --- Pointer -------------------------------------------------------------------

  private setPointer(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.parallax.copy(this.pointer);
  }

  private pickLayer() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    let best = Infinity;
    let layer = -1;
    this.machine.layers.forEach((l, i) => {
      const hit = this.raycaster.intersectObjects(l.pickables, false)[0];
      if (hit && hit.distance < best) {
        best = hit.distance;
        layer = i;
      }
    });
    return layer;
  }

  private onPointerDown = (e: PointerEvent) => {
    this.setPointer(e);
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, depth: this.depthTarget, moved: false };
    this.renderer.domElement.setPointerCapture(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent) => {
    this.setPointer(e);
    const d = this.drag;
    if (d && d.id === e.pointerId) {
      const delta = (d.y - e.clientY) / 160 + (d.x - e.clientX) / 260;
      if (Math.abs(e.clientY - d.y) + Math.abs(e.clientX - d.x) > 5) d.moved = true;
      if (d.moved) {
        this.followPacket = false;
        this.depthTarget = THREE.MathUtils.clamp(d.depth + delta, 0, MAX_DEPTH);
        this.depthRate = 14;
        this.root.classList.add('is-dragging');
      }
    } else {
      this.renderer.domElement.style.cursor = this.pickLayer() >= 0 ? 'pointer' : 'ns-resize';
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || d.id !== e.pointerId) return;
    this.drag = null;
    this.root.classList.remove('is-dragging');
    this.renderer.domElement.releasePointerCapture(e.pointerId);
    if (!d.moved) {
      const layer = this.pickLayer();
      if (layer >= 0) this.goTo(layer);
    } else {
      // Settle on the nearest layer.
      this.goTo(Math.round(this.depthTarget), 6);
    }
  };

  // --- Frame loop ------------------------------------------------------------------

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.ui.stage;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    this.composer.setSize(w, h);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.labels.setSize(w, h);
  }

  private start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    if (!this.running) return;
    requestAnimationFrame(this.tick);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.clock += dt;
    this.step(dt);
    this.composer.render();
    this.labels.render(this.scene, this.camera);
  };

  /** Camera offsets from the plate being viewed (landscape / portrait). */
  rig = {
    landscape: new THREE.Vector3(7.5, 5.8, 15.5),
    portrait: new THREE.Vector3(4.6, 8, 24),
    target: new THREE.Vector3(0.3, 1.3, 0),
  };

  private cameraRig(y: number) {
    const a = this.camera.aspect;
    const off = (a >= 1 ? this.rig.landscape : this.rig.portrait).clone();
    if (a >= 1 && a < 1.5) off.multiplyScalar(1.15);
    const target = this.rig.target.clone();
    if (a < 1) target.x = -0.3;
    else if (a < 1.3) target.x = 0;
    target.y += y;
    off.x += this.parallax.x * 0.7;
    off.y += this.parallax.y * 0.35;
    return { pos: target.clone().add(off), target };
  }

  private step(dt: number) {
    const damp = (rate: number) => 1 - Math.exp(-dt * rate);
    if (this.followPacket && this.machine.tracing) {
      this.depthTarget = Math.min(MAX_DEPTH, this.machine.packetDepth);
      this.depthRate = 7;
    }
    this.depth += (this.depthTarget - this.depth) * damp(this.depthRate);
    if (Math.abs(this.depthTarget - this.depth) < 1e-4) this.depth = this.depthTarget;

    const y = -this.depth * SPACING;
    const rig = this.cameraRig(y);
    this.camera.position.lerp(rig.pos, damp(8));
    this.camera.lookAt(rig.target);
    // Fog scales with the camera distance so phones (further back) aren't swallowed.
    const dist = rig.pos.distanceTo(rig.target);
    const fog = this.scene.fog as THREE.Fog;
    fog.near = dist * 0.8;
    fog.far = dist * 2.1;
    this.key.position.set(rig.target.x + 3, y + 7, 5);
    this.key.target.position.set(rig.target.x, y, 0);
    // Keep the plate we are looking at sharp; the layers above and below blur.
    (this.bokeh.uniforms as Record<string, THREE.IUniform>).focus.value = this.camera.position.distanceTo(
      new THREE.Vector3(-0.5, y, 0.3)
    );

    this.machine.update(this.clock, dt);
    this.updateUI();
  }

  private updateUI() {
    const d = this.depth;
    const active = Math.round(d);
    const off = Math.abs(d - active);
    const key = `${d.toFixed(3)}|${this.hitRate}|${this.simd}`;
    if (key === this.lastUI) return;
    this.lastUI = key;

    const ns = latencyAt(d);
    const layer = LAYERS[active];
    const { readout: r, card, slider, sliderOut } = this.ui;
    r.layer.textContent = `${layer.code} · ${layer.name}`;
    r.latency.textContent = formatLatency(ns);
    r.human.textContent = humanScale(ns);
    r.cycles.textContent = cycles(ns);
    r.amat.textContent = `${formatLatency(amat(this.hitRate))} @ ${Math.round(this.hitRate * 100)}%`;
    r.simd.textContent = simdName(this.simd);
    if (document.activeElement !== slider) slider.value = String(Math.round((d / MAX_DEPTH) * 1000));
    slider.setAttribute('aria-valuetext', `${layer.name}, ${formatLatency(ns)}`);
    if (sliderOut) sliderOut.textContent = formatLatency(ns);

    this.tags.forEach((t, i) => {
      t.classList.toggle('is-sharp', i === active && off < 0.15);
    });
    this.ui.layerButtons.forEach((b, i) => b.classList.toggle('is-active', i === active));

    // The project card blurs as you leave its layer.
    const s = layer.subject;
    const sharp = off < 0.15;
    if (card.root.dataset.shown !== s.id) {
      card.root.dataset.shown = s.id;
      card.index.textContent = layer.code;
      card.dist.textContent = formatLatency(layer.latency);
      card.title.textContent = s.title;
      card.kind.textContent = s.kind;
      card.blurb.textContent = s.blurb;
      card.metrics.innerHTML = s.metrics.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
      card.links.innerHTML =
        `<a href="#${s.anchor}">Case study ↓</a>` +
        s.links.map((l) => `<a href="${l.href}" target="_blank" rel="noopener noreferrer">${l.label} ↗</a>`).join('');
      card.root.style.setProperty('--subject', `#${layer.color.toString(16).padStart(6, '0')}`);
    }
    card.root.classList.toggle('is-sharp', sharp);
    card.state.textContent = sharp ? 'In focus' : `Between layers`;
    card.body.style.setProperty('--blur', `${sharp ? 0 : Math.min(5, off * 12).toFixed(2)}px`);
  }
}

export function startStack(root: HTMLElement) {
  try {
    const probe = document.createElement('canvas');
    if (!probe.getContext('webgl2')) throw new Error('no webgl2');
    const stack = new Stack(root);
    if (import.meta.env.DEV) (window as unknown as { stack: Stack }).stack = stack;
    return stack;
  } catch (err) {
    root.classList.add('is-fallback');
    console.warn('Stack lab unavailable:', err);
    return null;
  }
}

