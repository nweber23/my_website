import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  APERTURES,
  COC_LIMIT,
  MAX_EXTENSION,
  blurDisc,
  depthOfField,
  focusFromRing,
  formatDistance,
  hyperfocal,
  ringFromFocus,
} from './optics';
import { Lens } from './lens';
import { Diorama } from './diorama';
import { LightPath } from './rays';
import { SensorView } from './sensorView';
import { SUBJECTS } from './subjects';

const BG = 0x0b0b0c;

interface View {
  pos: THREE.Vector3;
  target: THREE.Vector3;
}

function $(root: ParentNode, sel: string) {
  return root.querySelector<HTMLElement>(sel);
}

function el(tag: string, cls: string, html = '') {
  const e = document.createElement(tag);
  e.className = cls;
  e.innerHTML = html;
  return e;
}

function formatLength(mm: number) {
  if (!isFinite(mm) || mm > 1e6) return '∞';
  if (mm < 1000) return `${(mm / 10).toFixed(1)} cm`;
  return formatDistance(mm);
}

export class Lab {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private composer: EffectComposer;
  private labels = new CSS2DRenderer();
  private lens = new Lens();
  private diorama = new Diorama();
  private light: LightPath;
  private sensor = new SensorView(720);
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2(9, 9);
  private pointerDirty = false;

  private ring = 0;
  private ringTarget = 0;
  private ringRate = 8;
  private aperture = 2;
  private apertureTarget = 2;
  private explode = 0;
  private explodeTarget = 0;
  private sensorOn = true;
  private sensorDirty = true;
  private active = 0;
  private dragging: { id: number; x: number; y: number; ring: number } | null = null;
  private press: { x: number; y: number; subject: number } | null = null;
  private hoverGrip = false;

  views: { overview: View; exploded: View; portrait: View };
  private camTween: { from: View; to: View; t: number } | null = null;
  private running = false;
  private last = performance.now();
  private reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private coarse = window.matchMedia('(pointer: coarse)').matches;

  private ui: {
    stage: HTMLElement;
    viewfinder: HTMLElement;
    screen: HTMLElement;
    vfMeta: HTMLElement | null;
    slider: HTMLInputElement;
    sliderOut: HTMLElement | null;
    readout: Record<string, HTMLElement>;
    card: Record<string, HTMLElement>;
    subjectButtons: HTMLButtonElement[];
    apertureButtons: HTMLButtonElement[];
    explode: HTMLButtonElement | null;
    sensorToggle: HTMLButtonElement | null;
  };
  private tags: { el: HTMLElement; dist: HTMLElement }[] = [];
  private partTags: HTMLElement[] = [];
  private planeTag: HTMLElement;
  private nearTag: HTMLElement;
  private farTag: HTMLElement;
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
      viewfinder: $(root, '[data-viewfinder]')!,
      screen: $(root, '[data-viewfinder-screen]')!,
      vfMeta: $(root, '[data-viewfinder-meta]'),
      slider: $(root, '[data-focus]') as HTMLInputElement,
      sliderOut: $(root, '[data-focus-out]'),
      readout,
      card,
      subjectButtons: [...root.querySelectorAll<HTMLButtonElement>('[data-subject]')],
      apertureButtons: [...root.querySelectorAll<HTMLButtonElement>('[data-aperture]')],
      explode: $(root, '[data-explode]') as HTMLButtonElement | null,
      sensorToggle: $(root, '[data-sensor-toggle]') as HTMLButtonElement | null,
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
      'Interactive 50 mm lens. Arrow keys turn the focus ring, 1 to 5 focus on a project, A changes aperture, X toggles the exploded view, S the sensor view.'
    );
    stage.prepend(canvas);
    this.labels.domElement.className = 'lab__labels';
    stage.appendChild(this.labels.domElement);

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 120);
    this.views = {
      overview: { pos: new THREE.Vector3(-5.3, 3.75, 6.3), target: new THREE.Vector3(4.5, 0.12, 0.45) },
      exploded: { pos: new THREE.Vector3(-0.9, 2.1, 4.4), target: new THREE.Vector3(0.75, 0.85, 0) },
      // Tall screens look down the bench so depth runs up the frame.
      portrait: { pos: new THREE.Vector3(-3.1, 4.4, 3.8), target: new THREE.Vector3(3.7, 0.3, 0.1) },
    };

    // Our pointer handlers must run before OrbitControls sees the event.
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
    canvas.addEventListener('pointerleave', () => this.pointer.set(9, 9));
    canvas.addEventListener('keydown', this.onKey);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.enableZoom = !this.coarse;
    this.controls.zoomToCursor = false;
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 16;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = 1.45;
    this.controls.minAzimuthAngle = -1.5;
    this.controls.maxAzimuthAngle = 0.5;
    if (this.coarse) {
      // Keep page scrolling on phones; the focus slider and ring still work.
      this.controls.enableRotate = false;
      canvas.style.touchAction = 'pan-y';
    }
    this.applyView(this.homeView());

    this.buildScene();
    this.light = new LightPath(SUBJECTS.map((s) => s.color));
    this.scene.add(this.light.root);
    this.lens.setSensorTexture(this.sensor.output.texture);

    this.composer = new EffectComposer(
      this.renderer,
      new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 })
    );
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.55, 0.92));
    this.composer.addPass(new OutputPass());

    const tag = (cls: string, html: string, anchor: THREE.Object3D) => {
      const e = el('div', cls, html);
      anchor.add(new CSS2DObject(e));
      return e;
    };
    this.diorama.subjects.forEach((p, i) => {
      const button = el(
        'button',
        'tag3d',
        `<span class="tag3d__idx">${p.subject.index}</span><span class="tag3d__name">${p.subject.short}</span><span class="tag3d__dist">${formatDistance(p.subject.distance)}</span>`
      );
      button.setAttribute('type', 'button');
      button.setAttribute('tabindex', '-1');
      button.addEventListener('click', () => this.rackTo(i));
      p.labelAnchor.add(new CSS2DObject(button));
      this.tags.push({ el: button, dist: button.querySelector('.tag3d__dist')! });
    });
    this.lens.labels.forEach((l) =>
      this.partTags.push(tag('part3d', `<b>${l.title}</b><span>${l.note}</span>`, l.anchor))
    );
    this.planeTag = tag('plane3d', 'Plane of focus <b>∞</b>', this.light.focusLabel);
    this.nearTag = tag('lim3d', 'near', this.light.nearLabel);
    this.farTag = tag('lim3d', 'far', this.light.farLabel);

    this.bindUI();
    new ResizeObserver(() => this.resize()).observe(stage);
    this.resize();

    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) this.start();
      else this.running = false;
    }).observe(root);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.running = false;
      else this.start();
    });

    root.classList.add('is-live');
    // Opening move: rack focus from infinity onto the first subject.
    if (this.reduceMotion) {
      this.ring = this.ringTarget = ringFromFocus(SUBJECTS[0].distance);
    } else {
      window.setTimeout(() => this.rackTo(0, 2.2), 450);
    }
  }

  private buildScene() {
    const s = this.scene;
    s.background = new THREE.Color(BG);
    s.fog = new THREE.Fog(BG, 16, 36);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    s.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    s.environmentIntensity = 0.45;

    const key = new THREE.DirectionalLight(0xfff0dc, 2.4);
    key.position.set(-1.5, 8, 7);
    key.target.position.set(5, 0, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera;
    sc.left = -9;
    sc.right = 9;
    sc.top = 9;
    sc.bottom = -9;
    sc.near = 1;
    sc.far = 30;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    s.add(key, key.target);

    const rim = new THREE.DirectionalLight(0x9cc8ff, 1.1);
    rim.position.set(12, 5, -8);
    s.add(rim);
    s.add(new THREE.HemisphereLight(0xb4c4d8, 0x0b0b0c, 0.35));

    // A narrow spot over each plinth, like a gallery.
    for (const p of this.diorama.subjects) {
      const spot = new THREE.SpotLight(0xfff3e6, 2.5 + p.anchor.x * 0.75, 0, 0.42, 0.7, 1.2);
      spot.position.set(p.anchor.x - 0.8, p.anchor.y + 3.2 + p.anchor.x * 0.08, p.anchor.z + 1.2);
      spot.target.position.copy(p.anchor);
      s.add(spot, spot.target);
    }

    s.add(this.diorama.root, this.lens.root);
  }

  private bindUI() {
    const { slider, subjectButtons, apertureButtons, explode, sensorToggle } = this.ui;
    slider.addEventListener('input', () => {
      this.ringTarget = Number(slider.value) / 1000;
      this.ringRate = 14;
    });
    subjectButtons.forEach((b) => b.addEventListener('click', () => this.rackTo(Number(b.dataset.subject))));
    apertureButtons.forEach((b) => b.addEventListener('click', () => this.setAperture(Number(b.dataset.aperture))));
    explode?.addEventListener('click', () => this.toggleExplode());
    sensorToggle?.addEventListener('click', () => this.toggleSensor());
    document.querySelectorAll<HTMLElement>('[data-rack]').forEach((b) =>
      b.addEventListener('click', () => {
        this.root.scrollIntoView({ behavior: this.reduceMotion ? 'auto' : 'smooth' });
        window.setTimeout(() => this.rackTo(Number(b.dataset.rack), 2.6), this.reduceMotion ? 0 : 500);
      })
    );
    window.addEventListener('keydown', (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t !== document.body && !this.root.contains(t)) return;
      if (t instanceof HTMLInputElement || t === this.renderer.domElement) return;
      if (!this.running) return;
      this.handleKey(e);
    });
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      this.ringTarget = Math.min(1, this.ringTarget + 0.02);
      this.ringRate = 12;
      e.preventDefault();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      this.ringTarget = Math.max(0, this.ringTarget - 0.02);
      this.ringRate = 12;
      e.preventDefault();
    } else this.handleKey(e);
  };

  private handleKey(e: KeyboardEvent) {
    const k = e.key.toLowerCase();
    if (k >= '1' && k <= '5') this.rackTo(Number(k) - 1);
    else if (k === 'x') this.toggleExplode();
    else if (k === 's') this.toggleSensor();
    else if (k === 'a') {
      const i = APERTURES.indexOf(this.apertureTarget as (typeof APERTURES)[number]);
      this.setAperture(APERTURES[(i + 1) % APERTURES.length]);
    } else return;
    e.preventDefault();
  }

  rackTo(i: number, rate = 3.2) {
    this.active = i;
    this.ringTarget = ringFromFocus(SUBJECTS[i].distance);
    this.ringRate = this.reduceMotion ? 60 : rate;
    if (this.explodeTarget > 0) this.toggleExplode();
  }

  private setAperture(n: number) {
    this.apertureTarget = n;
    this.ui.apertureButtons.forEach((b) =>
      b.setAttribute('aria-checked', String(Number(b.dataset.aperture) === n))
    );
  }

  private toggleExplode() {
    this.explodeTarget = this.explodeTarget > 0 ? 0 : 1;
    this.ui.explode?.setAttribute('aria-pressed', String(this.explodeTarget > 0));
    this.root.classList.toggle('is-exploded', this.explodeTarget > 0);
    this.flyTo(this.explodeTarget > 0 ? this.views.exploded : this.homeView());
  }

  private toggleSensor() {
    this.sensorOn = !this.sensorOn;
    this.sensorDirty = true;
    this.ui.sensorToggle?.setAttribute('aria-pressed', String(this.sensorOn));
    this.ui.viewfinder.hidden = !this.sensorOn;
  }

  applyView(v: View) {
    const k = this.framing();
    const off = v.pos.clone().sub(v.target).multiplyScalar(k);
    this.camera.position.copy(v.target).add(off);
    this.controls.target.copy(v.target);
    this.controls.update();
  }

  private homeView() {
    return this.camera.aspect < 1 ? this.views.portrait : this.views.overview;
  }

  /** Pull back on narrower viewports so the whole bench stays in frame. */
  private framing() {
    const a = this.camera.aspect;
    return a >= 1.5 ? 1 : a >= 1 ? 1.2 : 1.25;
  }

  private flyTo(to: View) {
    const k = this.framing();
    const target = { pos: to.target.clone().add(to.pos.clone().sub(to.target).multiplyScalar(k)), target: to.target.clone() };
    const from = { pos: this.camera.position.clone(), target: this.controls.target.clone() };
    if (this.reduceMotion) {
      this.camera.position.copy(target.pos);
      this.controls.target.copy(target.target);
      return;
    }
    this.camTween = { from, to: target, t: 0 };
  }

  private setPointer(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  private pick(): { grip: boolean; subject: number } {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const grip = this.raycaster.intersectObjects(this.lens.grips, false).length > 0;
    let subject = -1;
    let best = Infinity;
    this.diorama.subjects.forEach((p, i) => {
      const hit = this.raycaster.intersectObjects(p.pickables, false)[0];
      if (hit && hit.distance < best) {
        best = hit.distance;
        subject = i;
      }
    });
    return { grip, subject };
  }

  private onPointerDown = (e: PointerEvent) => {
    this.setPointer(e);
    const { grip, subject } = this.pick();
    if (grip) {
      this.controls.enabled = false;
      this.dragging = { id: e.pointerId, x: e.clientX, y: e.clientY, ring: this.ringTarget };
      this.renderer.domElement.setPointerCapture(e.pointerId);
      this.root.classList.add('is-dragging');
    } else {
      this.press = { x: e.clientX, y: e.clientY, subject };
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    this.setPointer(e);
    this.pointerDirty = true;
    const d = this.dragging;
    if (d && d.id === e.pointerId) {
      const delta = (d.y - e.clientY) / 320 + (e.clientX - d.x) / 380;
      this.ringTarget = THREE.MathUtils.clamp(d.ring + delta, 0, 1);
      this.ringRate = 22;
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.dragging && this.dragging.id === e.pointerId) {
      this.dragging = null;
      this.controls.enabled = true;
      this.root.classList.remove('is-dragging');
      this.renderer.domElement.releasePointerCapture(e.pointerId);
      return;
    }
    const p = this.press;
    this.press = null;
    if (p && p.subject >= 0 && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 6) this.rackTo(p.subject);
  };

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.ui.stage;
    if (!w || !h) return;
    const prevK = this.framing();
    const wasPortrait = this.camera.aspect < 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const k = this.framing();
    if (wasPortrait !== this.camera.aspect < 1 && !this.explodeTarget) {
      this.applyView(this.homeView());
    } else if (k !== prevK) {
      const off = this.camera.position.clone().sub(this.controls.target).multiplyScalar(k / prevK);
      this.camera.position.copy(this.controls.target).add(off);
    }
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
    this.step(dt);
    this.render();
  };

  private step(dt: number) {
    const damp = (rate: number) => 1 - Math.exp(-dt * rate);
    const prevRing = this.ring;
    const prevAp = this.aperture;
    this.ring += (this.ringTarget - this.ring) * damp(this.ringRate);
    if (Math.abs(this.ringTarget - this.ring) < 1e-5) this.ring = this.ringTarget;
    const la = Math.log(this.aperture);
    this.aperture = Math.exp(la + (Math.log(this.apertureTarget) - la) * damp(7));
    if (Math.abs(this.aperture - this.apertureTarget) < 1e-4) this.aperture = this.apertureTarget;
    this.explode += (this.explodeTarget - this.explode) * damp(4.5);
    if (Math.abs(this.explode - this.explodeTarget) < 1e-4) this.explode = this.explodeTarget;
    if (prevRing !== this.ring || prevAp !== this.aperture) this.sensorDirty = true;

    if (this.camTween) {
      const tw = this.camTween;
      tw.t = Math.min(1, tw.t + dt / 1.3);
      const e = tw.t < 0.5 ? 4 * tw.t ** 3 : 1 - (-2 * tw.t + 2) ** 3 / 2;
      this.camera.position.lerpVectors(tw.from.pos, tw.to.pos, e);
      this.controls.target.lerpVectors(tw.from.target, tw.to.target, e);
      if (tw.t >= 1) this.camTween = null;
    }
    this.controls.update();

    const focus = focusFromRing(this.ring);
    const dof = depthOfField(focus, this.aperture);
    this.lens.update({ ring: this.ring, aperture: this.aperture, explode: this.explode });

    // The active subject is whichever sits closest to the plane of focus.
    if (!this.dragging && Math.abs(this.ringTarget - this.ring) > 1e-3 && this.ringRate < 5) {
      // Mid-rack: keep the subject we were asked to focus on.
    } else {
      const lf = Math.log(isFinite(focus) ? focus : 1e5);
      let best = Infinity;
      SUBJECTS.forEach((s, i) => {
        const dd = Math.abs(Math.log(s.distance) - lf);
        if (dd < best) {
          best = dd;
          this.active = i;
        }
      });
    }

    this.light.update({
      subjects: this.diorama.subjects.map((p) => ({ anchor: p.anchor, distance: p.subject.distance })),
      active: this.active,
      focus,
      aperture: this.aperture,
      ring: this.ring,
      near: dof.near,
      far: dof.far,
      visibility: 1 - this.explode,
    });

    if (this.pointerDirty && !this.dragging) {
      this.pointerDirty = false;
      const { grip, subject } = this.pick();
      if (grip !== this.hoverGrip) {
        this.hoverGrip = grip;
        this.lens.setHover(grip);
      }
      this.renderer.domElement.style.cursor = grip ? 'grab' : subject >= 0 ? 'pointer' : '';
    }

    this.updateUI(focus, dof);
  }

  private updateUI(focus: number, dof: { near: number; far: number; total: number }) {
    const n = this.aperture;
    const s = SUBJECTS[this.active];
    const blur = blurDisc(s.distance, focus, n);
    const ratio = blur / COC_LIMIT;
    const key = `${this.ring.toFixed(4)}|${n.toFixed(3)}|${this.active}|${this.explode.toFixed(2)}`;
    if (key === this.lastUI) return;
    this.lastUI = key;

    const { readout: r, card, slider, sliderOut } = this.ui;
    const focusText = formatDistance(focus);
    r.focus.textContent = focusText;
    r.zone.textContent = `${formatDistance(dof.near)} – ${formatDistance(dof.far)}`;
    r.dof.textContent = formatLength(dof.total);
    r.hyper.textContent = formatDistance(hyperfocal(n), 1);
    r.travel.textContent = `${(this.ring * MAX_EXTENSION).toFixed(2)} mm`;
    r.blur.textContent = ratio <= 1 ? `${blur.toFixed(3)} mm · sharp` : `${blur.toFixed(2)} mm · ${ratio.toFixed(0)}× limit`;
    if (document.activeElement !== slider) slider.value = String(Math.round(this.ring * 1000));
    slider.setAttribute('aria-valuetext', focusText);
    if (sliderOut) sliderOut.textContent = focusText;
    const nText = Number.isInteger(Math.round(n * 10) / 10) ? n.toFixed(0) : n.toFixed(1);
    if (this.ui.vfMeta) this.ui.vfMeta.textContent = `50 mm · f/${nText} · ${focusText}`;

    this.planeTag.innerHTML = `Plane of focus <b>${focusText}</b>`;
    this.nearTag.textContent = `near ${formatDistance(dof.near)}`;
    this.farTag.textContent = `far ${formatDistance(dof.far)}`;

    // Subject tags light up when their blur disc is under the CoC limit.
    this.tags.forEach((t, i) => {
      const b = blurDisc(SUBJECTS[i].distance, focus, n);
      t.el.classList.toggle('is-sharp', b <= COC_LIMIT);
      t.el.classList.toggle('is-active', i === this.active);
    });
    this.ui.subjectButtons.forEach((b, i) => b.classList.toggle('is-active', i === this.active));
    this.partTags.forEach((p) => (p.style.opacity = String(Math.max(0, this.explode * 1.6 - 0.6))));

    // The project card is literally out of focus until its subject is sharp.
    const sharp = ratio <= 1;
    if (card.root.dataset.shown !== s.id) {
      card.root.dataset.shown = s.id;
      card.index.textContent = s.index;
      card.dist.textContent = formatDistance(s.distance);
      card.title.textContent = s.title;
      card.kind.textContent = s.kind;
      card.blurb.textContent = s.blurb;
      card.metrics.innerHTML = s.metrics.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
      card.links.innerHTML =
        `<a href="#${s.anchor}">Case study ↓</a>` +
        s.links.map((l) => `<a href="${l.href}" target="_blank" rel="noopener noreferrer">${l.label} ↗</a>`).join('');
      card.root.style.setProperty('--subject', `#${s.color.toString(16).padStart(6, '0')}`);
    }
    card.root.classList.toggle('is-sharp', sharp);
    card.state.textContent = sharp ? 'In focus' : `Out of focus · ${ratio.toFixed(0)}×`;
    card.body.style.setProperty('--blur', `${sharp ? 0 : Math.min(5, 0.6 + Math.log2(ratio) * 1.1).toFixed(2)}px`);
  }

  private render() {
    const r = this.renderer;
    if (this.sensorOn && this.sensorDirty) {
      this.sensor.render(r, this.scene, { focus: focusFromRing(this.ring), aperture: this.aperture, ring: this.ring }, [
        this.lens.root,
        this.light.root,
      ]);
      this.sensorDirty = false;
    }
    this.composer.render();

    if (this.sensorOn && !this.ui.viewfinder.hidden && this.explode < 0.5) {
      const c = r.domElement.getBoundingClientRect();
      const v = this.ui.screen.getBoundingClientRect();
      if (v.width > 0) {
        r.autoClear = false;
        this.sensor.draw(r, { x: v.left - c.left, y: v.top - c.top, w: v.width, h: v.height }, c.height);
        r.autoClear = true;
        r.setViewport(0, 0, c.width, c.height);
      }
    }
    this.labels.render(this.scene, this.camera);
  }
}

export function startLab(root: HTMLElement) {
  try {
    const probe = document.createElement('canvas');
    if (!probe.getContext('webgl2')) throw new Error('no webgl2');
    const lab = new Lab(root);
    if (import.meta.env.DEV) (window as unknown as { lab: Lab }).lab = lab;
    return lab;
  } catch (err) {
    root.classList.add('is-fallback');
    console.warn('Lens lab unavailable:', err);
    return null;
  }
}

