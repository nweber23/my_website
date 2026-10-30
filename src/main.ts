import '@fontsource-variable/inter';
import '@fontsource/anton';
import '@fontsource/space-mono/400.css';
import '@fontsource/rock-salt';
import './styles/base.css';
import './styles/home.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { paperCanvas } from './poster/textures';
import { DotMatrix } from './poster/dots';
import { Halftone } from './poster/halftone';
import { githubStats } from './shared/github';

gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduced) document.documentElement.classList.add('is-reduced');

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];
const EASE = 'expo.out'; // closest GSAP curve to cubic-bezier(0.16, 1, 0.3, 1)
/**
 * Map a continuous position (0..n-1) to one with a resting zone at every whole
 * number: the middle 64% of each step moves, the rest holds still.
 */
function dwell(x: number, n: number) {
  const i = Math.min(n - 1, Math.floor(x));
  if (i >= n - 1) return n - 1;
  const t = Math.min(1, Math.max(0, (x - i - 0.18) / 0.64));
  return i + t * t * t * (t * (t * 6 - 15) + 10);
}

const nextFrame = () => new Promise<void>((r) => setTimeout(r, 0));

const header = $('[data-header]');
const hero = $('[data-hero]');

// =========================================================================
// 1. LOADER — a real counter over the work the page has to do first.
// =========================================================================

class Loader {
  private shown = 0;
  private target = 0;
  private done = 0;
  private start = performance.now();
  private last = performance.now();
  private pct = $('[data-loader-pct]');
  private name = $('[data-loader-name]');
  constructor(private total: number) {
    gsap.ticker.add(this.tick);
  }
  step() {
    this.done++;
    this.target = (this.done / this.total) * 100;
  }
  private tick = () => {
    // Never faster than ~1.4 s overall, so the counter is readable.
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const cap = Math.min(100, ((now - this.start) / 1400) * 100);
    this.shown += (Math.min(this.target, cap) - this.shown) * (1 - Math.exp(-dt * 9));
    if (this.target >= 100 && cap >= 100 && this.shown > 99.4) this.shown = 100;
    this.pct.textContent = String(Math.floor(this.shown));
    this.name.style.setProperty('--p', this.shown.toFixed(1));
  };
  async finished() {
    while (this.shown < 100) await new Promise((r) => setTimeout(r, 30));
    gsap.ticker.remove(this.tick);
  }
}

// =========================================================================
// Boot
// =========================================================================

async function boot() {
  const loaderEl = $('[data-loader]');
  // Steps: fonts, paper, WebGL, dot matrix.
  const loader = new Loader(3);

  // Fonts the canvases need.
  await Promise.all([
    document.fonts.load('400 40px "Anton"'),
    document.fonts.load('400 16px "Space Mono"'),
    document.fonts.load('400 20px "Rock Salt"'),
  ]).catch(() => {});
  loader.step();

  // Full-bleed crinkled paper for the poster wall and the values section.
  await nextFrame();
  const paper = paperCanvas(1600, 1000, 19).toDataURL('image/jpeg', 0.86);
  $('[data-paper]').style.backgroundImage = `url(${paper})`;
  $('[data-values]').style.backgroundImage = `url(${paper})`;
  $('[data-values]').style.backgroundSize = 'cover';
  loader.step();

  const dots = new DotMatrix($<HTMLCanvasElement>('[data-dots]'), 'NWEBER', reduced);
  loader.step();

  const lenis = reduced ? null : new Lenis({ lerp: 0.09, wheelMultiplier: 1 });
  if (lenis) {
    lenis.stop();
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  setupMotion({ dots, lenis });

  await loader.finished();
  await intro(loaderEl);
  lenis?.start();
  ScrollTrigger.refresh();
}

/** The loader fades into the hero (same name, same spot); then the build log types out. */
function intro(loaderEl: HTMLElement) {
  const log = $$('[data-hero-log] span');
  const status = $('[data-hero-status]');
  const rest = [header, '[data-hero-intro]', '[data-hero-hint]'];
  gsap.set(log, { clipPath: 'inset(0 100% 0 0)' });
  gsap.set(rest, { opacity: 0, y: 12 });
  if (reduced) {
    loaderEl.remove();
    gsap.set(log, { clipPath: 'none' });
    gsap.set(rest, { opacity: 1, y: 0 });
    status.textContent = 'READY';
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    gsap
      .timeline()
      .to(loaderEl, { opacity: 0, duration: 0.7, ease: 'power1.inOut' })
      .set(loaderEl, { display: 'none' })
      .call(resolve) // scrolling unlocks while the log is still typing
      .to(log, { clipPath: 'inset(0 0% 0 0)', duration: 0.4, ease: 'steps(20)', stagger: 0.22 })
      .call(() => { status.textContent = 'READY'; })
      .to(rest, { opacity: 1, y: 0, duration: 1, stagger: 0.1, ease: EASE }, '-=0.5');
  });
}

// =========================================================================
// 2–9. MOTION
// =========================================================================

interface Stage {
  dots: DotMatrix;
  lenis: Lenis | null;
}

function setupMotion({ dots, lenis }: Stage) {
  // --- 2. Global: header nudge, nav pill, anchor links --------------------
  lenis?.on('scroll', ({ scroll }: { scroll: number }) => header.classList.toggle('is-scrolled', scroll > 8));
  if (!lenis) window.addEventListener('scroll', () => header.classList.toggle('is-scrolled', scrollY > 8), { passive: true });

  $$<HTMLAnchorElement>('a[href^="#"]').forEach((a) =>
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href')!.slice(1);
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      e.preventDefault();
      if (target instanceof HTMLDetailsElement) target.open = true;
      if (lenis) lenis.scrollTo(target, { offset: -20, duration: 1.4 });
      else target.scrollIntoView();
    })
  );

  // --- 3. Hero: living name, then the wall slides up and pushes it away --------
  header.classList.add('is-dark'); // light header over the navy sheet
  setupHero();

  // --- 4. Poster wall ---------------------------------------------------------
  const wall = $('[data-wall]');
  $$('.wall__stars .star', wall).forEach((star, i) => {
    gsap.fromTo(
      star,
      { scale: 0, rotation: 0 },
      {
        scale: 1,
        rotation: 45,
        duration: 1.2,
        delay: i * 0.08,
        ease: EASE,
        scrollTrigger: { trigger: wall, start: 'top 55%', toggleActions: 'play none none reverse' },
        onComplete: () => {
          if (!reduced) gsap.to(star, { rotation: '+=360', duration: 70 + i * 6, repeat: -1, ease: 'none' });
        },
      }
    );
  });
  if (!reduced) {
    gsap.to('[data-wall-label]', { y: -140, ease: 'none', scrollTrigger: { trigger: wall, start: 'top top', end: 'bottom top', scrub: true } });
    gsap.fromTo('.wall__poster', { yPercent: 18 }, { yPercent: -12, ease: 'none', scrollTrigger: { trigger: wall, start: 'top bottom', end: 'bottom top', scrub: true } });
  }

  // --- 5. Giant text rows -------------------------------------------------------
  const rowsSection = $('[data-rows]');
  if (!reduced) {
    $$('[data-row]', rowsSection).forEach((row, i) => {
      const travel = 22 + (i % 3) * 6;
      const left = i % 2 === 0;
      gsap.fromTo(
        row,
        { xPercent: left ? 0 : -travel },
        { xPercent: left ? -travel : 0, ease: 'none', scrollTrigger: { trigger: rowsSection, start: 'top bottom', end: 'bottom top', scrub: 1 } }
      );
    });
    // Rows lean into the scroll: skew follows scroll velocity and springs back.
    const skewTo = $$('[data-row]', rowsSection).map((row, i) => {
      const to = gsap.quickTo(row, 'skewX', { duration: 0.6, ease: 'power3.out' });
      return (v: number) => to(i % 2 ? -v : v);
    });
    ScrollTrigger.create({
      trigger: rowsSection,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (s) => {
        const v = gsap.utils.clamp(-9, 9, s.getVelocity() / 260);
        skewTo.forEach((to) => to(v));
      },
      onLeave: () => skewTo.forEach((to) => to(0)),
      onLeaveBack: () => skewTo.forEach((to) => to(0)),
    });
  }
  const circle = $('.circled path', rowsSection);
  if (circle) {
    gsap.to(circle, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: circle.closest('.circled')!, start: 'top 80%', end: 'top 40%', scrub: reduced ? false : true } });
  }
  // QR blocks step pixel by pixel while on screen.
  let qrTimer = 0;
  ScrollTrigger.create({
    trigger: rowsSection,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (s) => {
      clearInterval(qrTimer);
      if (!s.isActive || reduced) return;
      const cells = $$<SVGRectElement>('[data-flicker] rect', rowsSection);
      qrTimer = window.setInterval(() => {
        for (let k = 0; k < 4; k++) {
          const c = cells[Math.floor(Math.random() * cells.length)];
          c.style.opacity = c.style.opacity === '0' ? '1' : '0';
        }
      }, 140);
    },
  });

  // --- 6. Values: pinned horizontal track ---------------------------------------
  const halftone = new Halftone($<HTMLCanvasElement>('[data-halftone]'), '/assets/minirt.webp', reduced);
  const values = $('[data-values]');
  const track = $('[data-values-track]');
  const fadeLayer = document.createElement('div');
  fadeLayer.style.cssText = 'position:absolute;inset:0;background:var(--bg-gradient);opacity:0;pointer-events:none;';
  values.prepend(fadeLayer);
  if (!reduced) {
    // Scroll sets a target position in panel units; one ticker eases toward it.
    // Each panel gets a dwell zone, so it settles centred before the next slides in.
    const panels = $$('[data-panel]', values);
    const ghosts = $('[data-ghosts]');
    const marks = $$('[data-values-progress] span', values);
    const bar = $('[data-values-progress] i', values);
    const n = panels.length;
    const dist = () => track.scrollWidth - innerWidth;
    const st = { pos: 0, target: 0, last: -1 };
    panels.forEach((panel) => [...panel.children].forEach((c, j) => (c as HTMLElement).style.setProperty('--px', String(36 + j * 26))));
    ScrollTrigger.create({
      trigger: values,
      pin: true,
      start: 'top top',
      end: () => `+=${innerHeight * (n - 1) * 1.5}`,
      invalidateOnRefresh: true,
      onUpdate: (s) => {
        st.target = dwell(s.progress * (n - 1), n);
        fadeLayer.style.opacity = s.progress.toFixed(3);
      },
      onRefresh: () => (st.last = -1),
    });
    gsap.ticker.add((_t, dtMs) => {
      st.pos += (st.target - st.pos) * (1 - Math.exp((-dtMs / 1000) * 7));
      if (Math.abs(st.target - st.pos) < 1e-4) st.pos = st.target;
      if (st.pos === st.last) return;
      st.last = st.pos;
      const x = -(st.pos / (n - 1)) * dist();
      track.style.transform = `translate3d(${x}px,0,0)`;
      // Ghost words sit inside the track: an extra 0.3× makes them run at 1.3×.
      ghosts.style.transform = `translate3d(${x * 0.3}px,0,0)`;
      panels.forEach((panel, i) => {
        const d = i - st.pos;
        panel.style.setProperty('--d', d.toFixed(4));
        panel.style.setProperty('--a', Math.min(1, Math.abs(d)).toFixed(4));
        // The halftone screen resolves from coarse to fine as its panel centres.
        if (panel.contains(halftone.element)) halftone.setDistance(Math.abs(d) * 1.4);
      });
      const active = Math.round(st.pos);
      marks.forEach((m, i) => m.classList.toggle('is-active', i === active));
      bar.style.transform = `scaleX(${(st.pos / (n - 1)).toFixed(4)})`;
    });
  } else {
    $$('[data-panel]', values).forEach((panel) =>
      gsap.from(panel.children, { opacity: 0, y: 30, duration: 1, stagger: 0.12, ease: EASE, scrollTrigger: { trigger: panel, start: 'top 75%' } })
    );
  }
  // --- 7. Projects: rotating prism ------------------------------------------------
  setupPrism();

  // Reveal for the index, notes and profile blocks.
  $$('.sec-head, .row, .notes__list li, .card, .foot__logo, .foot__row').forEach((el) => el.setAttribute('data-reveal', ''));
  // Footer items sit at the very end of the page, where 'top 85%' can be unreachable at max scroll.
  const reveal = (targets: string, start: string) =>
    ScrollTrigger.batch(targets, {
      start,
      onEnter: (batch) =>
        gsap.fromTo(
          batch,
          { opacity: 1, y: 14, clipPath: 'inset(100% 0% 0% 0%)' },
          { y: 0, clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, stagger: 0.1, ease: 'expo.out', overwrite: true, clearProps: 'clipPath' }
        ),
    });
  reveal('[data-reveal]:not(.foot__logo):not(.foot__row)', 'top 85%');
  reveal('.foot__logo, .foot__row', 'top bottom');

  // --- 8. Manifesto video -------------------------------------------------------------
  setupManifesto();

  // --- 9. Footer dot matrix -----------------------------------------------------------
  ScrollTrigger.create({
    trigger: '[data-foot]',
    start: 'top bottom',
    end: 'bottom bottom',
    onUpdate: (s) => (dots.progress = s.progress),
  });
  new IntersectionObserver(([e]) => (dots.visible = e.isIntersecting)).observe($('[data-dots]'));

  // Opening a project changes the page height; re-measure so the pinned manifesto scrubs from true positions.
  const remeasure = () => {
    ScrollTrigger.refresh();
    window.setTimeout(() => ScrollTrigger.refresh(), 500); // again after the height transition
  };
  $$('details.row').forEach((d) => d.addEventListener('toggle', remeasure));

  // Nav pill follows the section in view.
  setupNav();

  // GitHub numbers (static fallbacks in the markup).
  const gh = $('[data-github-stats]');
  if (gh) githubStats(gh).finally(() => ScrollTrigger.refresh()); // graph changes page height

  // --- Render loop: draw only what is on screen ----------------------------------------
  gsap.ticker.add(() => {
    if (dots.visible || reduced) dots.draw(performance.now());
  });
}

// --- 3. Hero ----------------------------------------------------------------------------------
function setupHero() {
  if (reduced) {
    ScrollTrigger.create({
      trigger: hero,
      start: 0,
      end: 'bottom 6%',
      onUpdate: (st) => header.classList.toggle('is-dark', st.progress < 1),
    });
    return;
  }
  const title = $('.hero__title');
  gsap.set(title, { transformOrigin: '50% 100%' });
  // One span per letter so each can move on its own.
  const letters = [...title.textContent!].map((ch) => {
    const el = document.createElement('span');
    el.textContent = ch === ' ' ? '\u00a0' : ch;
    return el;
  });
  title.replaceChildren(...letters);

  // Idle wave plus a lift toward the pointer, only while the hero is on screen.
  const pointer = { x: -9999, y: -9999 };
  window.addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });
  let on = true;
  new IntersectionObserver(([e]) => (on = e.isIntersecting)).observe(hero);
  const cur = letters.map(() => ({ y: 0, r: 0 }));
  gsap.ticker.add((t) => {
    if (!on) return;
    const hits = letters.map((el) => el.getBoundingClientRect());
    letters.forEach((el, i) => {
      const r = hits[i];
      const dx = pointer.x - (r.left + r.width / 2);
      const dy = pointer.y - (r.top + r.height / 2);
      const k = Math.max(0, 1 - Math.hypot(dx, dy) / 280);
      const wave = Math.sin(t * 1.6 + i * 0.55) * 0.02;
      cur[i].y += (-k * k * 0.08 + wave - cur[i].y) * 0.12;
      cur[i].r += (Math.sign(dx) * k * 2.5 - cur[i].r) * 0.12;
      el.style.transform = `translateY(${(cur[i].y * 100).toFixed(2)}%) rotate(${cur[i].r.toFixed(2)}deg)`;
    });
  });

  // Scroll: the build log and intro clear out, the poster wall rises and pushes the name up.
  const tl = gsap.timeline({ defaults: { ease: 'none' } });
  tl.to(['[data-hero-log]', '[data-hero-intro]', '[data-hero-hint]', '[data-hero-status]'], { opacity: 0, y: -30, duration: 0.3 }, 0);
  ScrollTrigger.create({
    trigger: hero,
    start: 'top top',
    end: '+=100%',
    pin: true,
    pinSpacing: false, // the poster wall slides up over the pinned hero: no empty scroll
    scrub: true,
    animation: tl,
    onUpdate: (st) => {
      header.classList.toggle('is-dark', st.progress < 0.9);
      // The wall's top edge sits at innerHeight * (1 - progress). It pushes the name up; the name shrinks
      // to stay whole between the header and that edge, then fades out at the very end.
      const edge = innerHeight * (1 - st.progress);
      const box = title.getBoundingClientRect(); // scaled about the bottom, so the bottom is unaffected by scale
      const rest = box.bottom - Number(gsap.getProperty(title, 'y'));
      const h = title.offsetHeight;
      const room = edge - 24 - header.offsetHeight;
      const scale = Math.max(0.12, Math.min(1, room / h));
      gsap.set(title, {
        y: Math.min(0, edge - 24 - rest),
        scale,
        opacity: Math.min(1, Math.max(0, (room / h - 0.04) / 0.1)),
      });
    },
    onLeaveBack: () => header.classList.add('is-dark'),
  });
}

// --- 7. Prism carousel ----------------------------------------------------------------------
function setupPrism() {
  const scene = $('[data-cube-scene]');
  const prism = $('[data-cube]');
  const faces = $$('[data-face]', prism);
  const caps = $$('[data-cap]');
  const counter = $('[data-cube-index]');
  const bar = $('[data-cube-bar]');
  const n = faces.length;
  const step = 360 / n;
  // pos is in project units (0..n-1). Scroll sets target; a ticker eases pos toward
  // it, so the prism turns continuously with the scroll instead of jumping.
  const st = { pos: 0, target: 0, tiltX: 0, tiltY: 0, tx: 0, ty: 0, dirty: true };
  let radius = 0;

  const apply = () => {
    // Mid-turn the prism eases back and tips a little, like a drum being spun.
    const turn = Math.abs(st.pos - Math.round(st.pos));
    const lift = Math.sin(turn * Math.PI);
    const angle = -st.pos * step - 18;
    prism.style.transform = `translateZ(${-radius - lift * radius * 0.45}px) rotateX(${st.tiltX - lift * 5}deg) rotateY(${angle + st.tiltY}deg)`;
    faces.forEach((f, i) => {
      // Faces turned away from the viewer darken, so the front one reads first.
      const rel = ((((i * step + angle) % 360) + 540) % 360) - 180;
      f.style.setProperty('--shade', Math.min(0.62, (Math.abs(rel) / 100) * 0.5).toFixed(3));
    });
    bar.style.transform = `scaleX(${(st.pos / (n - 1)).toFixed(4)})`;
  };
  const layout = () => {
    radius = prism.offsetWidth / (2 * Math.tan(Math.PI / n));
    faces.forEach((f, i) => (f.style.transform = `rotateY(${i * step}deg) translateZ(${radius}px)`));
    apply();
  };
  layout();
  window.addEventListener('resize', layout);

  let index = 0;
  const setActive = (i: number) => {
    if (i === index) return;
    index = i;
    caps.forEach((c, k) => c.classList.toggle('is-active', k === i));
    counter.textContent = String(i + 1).padStart(2, '0');
  };

  gsap.ticker.add((_t, dtMs) => {
    const k = (rate: number) => (reduced ? 1 : 1 - Math.exp((-dtMs / 1000) * rate));
    const before = st.pos + st.tiltX * 7 + st.tiltY * 13;
    st.pos += (st.target - st.pos) * k(6);
    st.tiltX += (st.tx - st.tiltX) * k(5);
    st.tiltY += (st.ty - st.tiltY) * k(5);
    if (Math.abs(st.target - st.pos) < 1e-4) st.pos = st.target;
    const after = st.pos + st.tiltX * 7 + st.tiltY * 13;
    if (!st.dirty && Math.abs(after - before) < 1e-5) return;
    st.dirty = false;
    apply();
    setActive(Math.round(st.pos));
  });

  if (!reduced) {
    ScrollTrigger.create({
      trigger: '[data-projects-pin]',
      start: 'top top',
      end: () => `+=${innerHeight * (n - 1) * 1.1}`,
      pin: true,
      invalidateOnRefresh: true,
      onUpdate: (s) => (st.target = dwell(s.progress * (n - 1), n)),
    });
    // Subtle tilt toward the cursor, eased by the same ticker.
    scene.addEventListener('pointermove', (e) => {
      const r = scene.getBoundingClientRect();
      st.tx = -((e.clientY - r.top) / r.height - 0.5) * 10;
      st.ty = ((e.clientX - r.left) / r.width - 0.5) * 10;
    });
    scene.addEventListener('pointerleave', () => (st.tx = st.ty = 0));
  } else {
    // Without the pin, step through the projects with a click.
    scene.addEventListener('click', () => (st.target = (Math.round(st.target) + 1) % n));
  }

  // A face opens its case study in the index.
  faces.forEach((f, i) =>
    f.addEventListener('click', () => {
      const id = caps[i].querySelector('a')?.getAttribute('href')?.slice(1);
      const row = id ? (document.getElementById(id) as HTMLDetailsElement | null) : null;
      if (!row) return;
      row.open = true;
      row.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    })
  );
}

// --- 8. Manifesto -----------------------------------------------------------------------------
function setupManifesto() {
  const section = $('[data-manifesto]');
  const pin = $('[data-manifesto-pin]');
  const frame = $('[data-manifesto-frame]');
  const video = $<HTMLVideoElement>('[data-manifesto-video]');
  const drum = $('[data-wheel]');
  const words = $$('.wheel__word', drum);
  const splitR = $('[data-split-r]');
  const splitB = $('[data-split-b]');

  // Load and play only near the viewport.
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) {
      const src = video.querySelector<HTMLSourceElement>('source[data-src]');
      if (src) {
        src.src = src.dataset.src!;
        src.removeAttribute('data-src');
        video.load();
      }
      video.play().catch(() => {});
    } else video.pause();
  }, { rootMargin: '200px' }).observe(section);

  if (reduced) return;

  // Analog glitch: a short horizontal jitter and wider RGB split every 2–4 s.
  const glitch = () => {
    const dx = 6 + Math.random() * 10;
    gsap.timeline()
      .to(video, { x: () => (Math.random() - 0.5) * 18, duration: 0.05, repeat: 5, yoyo: true, ease: 'steps(1)' })
      .call(() => { splitR.setAttribute('dx', String(dx)); splitB.setAttribute('dx', String(-dx)); }, [], 0)
      .call(() => { splitR.setAttribute('dx', '3'); splitB.setAttribute('dx', '-3'); }, [], 0.3)
      .set(video, { x: 0 });
    window.setTimeout(glitch, 2000 + Math.random() * 2000);
  };
  window.setTimeout(glitch, 2500);

  // Tag words on a drum: each word is placed from its offset to the centre, so the
  // centre word is full size and its neighbours squash, shrink and fade toward the
  // rim. Scroll sets a target (with a dwell per word); a ticker eases toward it.
  const WHEEL_END = 0.62;
  const wheel = { pos: 0, target: 0, last: -1 };
  const n = words.length;
  const placeWords = () => {
    const R = drum.clientHeight * 0.42;
    words.forEach((w, i) => {
      const d = i - wheel.pos;
      const a = Math.max(-1.6, Math.min(1.6, d * 0.62));
      const vis = Math.abs(d) < 3;
      w.style.visibility = vis ? 'visible' : 'hidden';
      if (!vis) return;
      const c = Math.cos(a);
      w.style.transform = `translate3d(0, ${(Math.sin(a) * R).toFixed(2)}px, 0) scale(${(0.72 + 0.28 * c).toFixed(4)}, ${Math.max(0.05, c).toFixed(4)})`;
      w.style.opacity = Math.max(0, c * c - 0.05 * Math.abs(d)).toFixed(3);
      w.classList.toggle('is-active', Math.abs(d) < 0.5);
    });
  };
  placeWords();
  gsap.ticker.add((_t, dtMs) => {
    wheel.pos += (wheel.target - wheel.pos) * (1 - Math.exp((-dtMs / 1000) * 6));
    if (Math.abs(wheel.target - wheel.pos) < 1e-4) wheel.pos = wheel.target;
    if (wheel.pos === wheel.last) return;
    wheel.last = wheel.pos;
    placeWords();
  });
  window.addEventListener('resize', placeWords);

  const tl = gsap.timeline({ defaults: { ease: 'none' } });
  tl.to({}, { duration: WHEEL_END }, 0)
    .to(['.manifesto__label', '.manifesto__quote', '.wheel'], { opacity: 0, duration: 0.06 }, WHEEL_END)
    // Exit: the screen shrinks to a small portrait while it bleaches to the cream page.
    .to(frame, {
      clipPath: () => `inset(${Math.max(0, (innerHeight - 245) / 2)}px ${Math.max(0, (innerWidth - 160) / 2)}px)`,
      duration: 0.3,
      ease: 'power2.inOut',
    }, 0.66)
    .to('[data-manifesto-bleach]', { opacity: 0.8, duration: 0.3 }, 0.66);

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom bottom',
    pin,
    pinSpacing: false,
    scrub: 1,
    animation: tl,
    invalidateOnRefresh: true,
    onUpdate: (st) => (wheel.target = dwell(Math.min(1, st.progress / WHEEL_END) * (n - 1), n)),
  });
  // Header turns light while the video is dark.
  ScrollTrigger.create({
    trigger: section,
    start: 'top 6%',
    end: () => `top+=${(section.offsetHeight - innerHeight) * 0.68} top`,
    toggleClass: { targets: header, className: 'is-dark' },
    invalidateOnRefresh: true,
  });
}

// --- Nav pill ------------------------------------------------------------------------------------
function setupNav() {
  const pill = $('[data-pill]');
  const slide = $('.pill__slide', pill);
  const links = $$<HTMLAnchorElement>('[data-nav]', pill);
  const owners: Record<string, string[]> = {
    work: ['[data-projects]', '.index', '.notes'],
    about: ['[data-values]', '.profile'],
    contact: ['[data-foot]'],
  };
  const live = new Set<string>();
  const paint = () => {
    const key = (['contact', 'about', 'work'] as const).find((k) => [...live].some((l) => l.startsWith(k)));
    links.forEach((l) => l.classList.toggle('is-active', l.dataset.nav === key));
    const active = links.find((l) => l.dataset.nav === key);
    pill.classList.toggle('has-active', !!active);
    if (active) {
      slide.style.width = `${active.offsetWidth}px`;
      slide.style.transform = `translateX(${active.offsetLeft}px)`;
    }
  };
  for (const [key, sels] of Object.entries(owners)) {
    sels.forEach((sel, i) => {
      const el = $(sel);
      const target = el.parentElement?.classList.contains('pin-spacer') ? el.parentElement : el;
      ScrollTrigger.create({
        trigger: target,
        start: 'top 55%',
        end: 'bottom 45%',
        onToggle: (s) => {
          s.isActive ? live.add(`${key}${i}`) : live.delete(`${key}${i}`);
          paint();
        },
      });
    });
  }
}

// Hero background: ASCII ocean, loaded after first paint.
function setupOcean() {
  const canvas = $<HTMLCanvasElement>('.hero__ocean');
  const io = new IntersectionObserver(async ([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    const { OceanEngine, defaultConfig } = await import('./poster/ocean');
    const cfg = Object.assign(defaultConfig(), {
      background: '#010736',
      gridColor: 'rgba(252,241,208,0.08)',
      fishRGB: [252, 241, 208],
      wakeRGB: [60, 90, 170],
      sharkTint: [1.05, 1.0, 0.85],
      accents: ['#fcf1d0', '#8fa6e0', '#22396f'],
    });
    const sharks = [1, 0.7, 0.84, 0.77].map((size) => ({ kind: 'classic', size }));
    new OceanEngine(canvas, sharks, undefined, cfg);
  }, { rootMargin: '400px' });
  io.observe(canvas);
}
setupOcean();

boot();
