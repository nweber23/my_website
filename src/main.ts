import { t } from './i18n';
import '@fontsource-variable/inter';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/jetbrains-mono';
import './styles/base.css';
import './styles/home.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Draggable } from 'gsap/Draggable';
import { InertiaPlugin } from 'gsap/InertiaPlugin';
import Lenis from 'lenis';
import { Halftone } from './poster/halftone';
import { githubStats } from './shared/github';

gsap.registerPlugin(ScrollTrigger, Draggable, InertiaPlugin);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Native scroll-driven animations (see home.css) replace the GSAP scrubs below; GSAP stays as the fallback. */
const sda = !reduced && CSS.supports('(animation-timeline: view()) and (animation-range: entry)');
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

/** Set by setupHero: drops the name's tiles onto the sheet. */
let heroDrop: (() => void) | null = null;

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
    // Never faster than ~1.1 s overall, so the counter is readable.
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const cap = Math.min(100, ((now - this.start) / 1100) * 100);
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
  // Steps: display font, mono font, first frame.
  const loader = new Loader(3);

  await document.fonts.load('800 40px "Bricolage Grotesque Variable"').catch(() => {});
  loader.step();
  await document.fonts.load('500 16px "JetBrains Mono Variable"').catch(() => {});
  loader.step();
  await nextFrame();
  loader.step();

  const lenis = reduced ? null : new Lenis({ lerp: 0.09, wheelMultiplier: 1 });
  if (lenis) {
    lenis.stop();
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  setupMotion({ lenis });

  await loader.finished();
  await intro(loaderEl);
  lenis?.start();
  ScrollTrigger.refresh();
}

/** The loader fades into the hero (same name, same spot); then the intro settles in. */
function intro(loaderEl: HTMLElement) {
  const status = $('[data-hero-status]');
  const rest = [header, '[data-hero-intro]', '[data-hero-strip]'];
  gsap.set(rest, { opacity: 0, y: 12 });
  if (reduced) {
    loaderEl.remove();
    gsap.set(rest, { opacity: 1, y: 0 });
    status.textContent = t('READY');
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    gsap
      .timeline()
      .call(() => heroDrop?.(), [], 0.15)
      .to(loaderEl, { opacity: 0, duration: 0.7, ease: 'power1.inOut' }, 0)
      .set(loaderEl, { display: 'none' })
      .call(resolve) // scrolling unlocks while the intro is still settling
      .call(() => { status.textContent = t('READY'); })
      .to(rest, { opacity: 1, y: 0, duration: 1, stagger: 0.1, ease: EASE }, '-=0.2');
  });
}

// =========================================================================
// 2–9. MOTION
// =========================================================================

interface Stage {
  lenis: Lenis | null;
}

function setupMotion({ lenis }: Stage) {
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

  // --- 4. First principles: build, break, rebuild ---------------------------------
  setupWall();

  // --- 5. Text rows: tape strips slapped onto the page, their text sliding along ------------------
  const rowsSection = $('[data-rows]');
  const rnd = gsap.utils.random;
  $$('[data-row]', rowsSection).forEach((row, i) => {
    if (reduced) return;
    const text = row.firstElementChild!;
    const travel = 14 + (i % 3) * 6;
    const left = i % 2 === 0;
    gsap.fromTo(
      text,
      { xPercent: left ? 0 : -travel },
      { xPercent: left ? -travel : 0, ease: 'none', scrollTrigger: { trigger: row, start: 'top bottom', end: 'bottom top', scrub: 0.8 } }
    );
    gsap.from(row, {
      scale: 1.4,
      y: 90,
      opacity: 0,
      duration: 0.75,
      ease: 'back.out(2.2)',
      scrollTrigger: { trigger: row, start: 'top 92%', toggleActions: 'play none none reverse' },
    });
  });
  if (!reduced) {
    // The strips lean into the scroll like tape being pulled, then settle back when you stop.
    const lean = $$('[data-row]', rowsSection).map((row, i) => {
      const to = gsap.quickTo(row, 'rotation', { duration: 0.7, ease: 'power3.out' });
      return (v: number) => to((i % 2 ? -1 : 1) * v);
    });
    let settle = 0;
    ScrollTrigger.create({
      trigger: rowsSection,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (st) => {
        const v = gsap.utils.clamp(-3.5, 3.5, st.getVelocity() / 500);
        lean.forEach((to) => to(v));
        window.clearTimeout(settle);
        settle = window.setTimeout(() => lean.forEach((to) => to(0)), 140);
      },
      onLeave: () => lean.forEach((to) => to(0)),
      onLeaveBack: () => lean.forEach((to) => to(0)),
    });
  }
  const circle = $('.circled path', rowsSection);
  if (circle && !sda) {
    gsap.to(circle, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: circle.closest('.circled')!, start: 'top 80%', end: 'top 40%', scrub: reduced ? false : true } });
  }

  // --- 6. About: loose cards that drop in and can be dragged around -------------------------------
  const halftone = new Halftone($<HTMLCanvasElement>('[data-halftone]'), '/assets/minirt.webp', reduced);
  halftone.setDistance(0);
  const values = $('[data-values]');
  if (!reduced) {
    const panels = $$('[data-panel]', values);
    panels.forEach((panel) =>
      gsap.from(panel, {
        y: -460,
        rotation: () => rnd(-28, 28),
        opacity: 0,
        duration: 1.5,
        ease: 'bounce.out',
        scrollTrigger: { trigger: panel, start: 'top 90%' },
      })
    );
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      Draggable.create(panels, {
        type: 'x,y',
        inertia: true,
        edgeResistance: 0.9,
        bounds: values,
        zIndexBoost: true,
        onPress: function (this: Draggable) {
          gsap.to(this.target, { scale: 1.06, duration: 0.3, ease: 'back.out(3)' });
        },
        onRelease: function (this: Draggable) {
          gsap.to(this.target, { scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.45)' });
        },
      });
    }
  }
  // --- 7. Projects: sticky preview ------------------------------------------------
  setupWork();

  // Section titles and the footer name: letters pop up one after another, springing into place.
  const letters = (el: HTMLElement) => {
    const text = el.textContent ?? '';
    el.setAttribute('aria-label', text);
    el.textContent = '';
    return [...text].map((ch) => {
      const sp = document.createElement('span');
      sp.className = 'pop';
      sp.setAttribute('aria-hidden', 'true');
      sp.textContent = ch === ' ' ? '\u00a0' : ch;
      el.append(sp);
      return sp;
    });
  };
  $$('.sec-head__title, .foot__logo').forEach((h) => {
    const chars = letters(h);
    if (reduced) return;
    gsap.from(chars, {
      yPercent: 110,
      rotation: () => gsap.utils.random(-22, 22),
      opacity: 0,
      duration: 0.8,
      stagger: 0.04,
      ease: 'back.out(2.2)',
      clearProps: 'transform',
      scrollTrigger: { trigger: h, start: 'top 90%' },
    });
  });

  // Reveal for the index, notes and profile blocks.
  $$('.sec-head, .row, .notes__list li, .card, .foot__logo, .foot__row').forEach((el) => el.setAttribute('data-reveal', ''));
  // Footer items sit at the very end of the page, where 'top 85%' can be unreachable at max scroll.
  const reveal = (targets: string, start: string) =>
    ScrollTrigger.batch(targets, {
      start,
      onEnter: (batch) =>
        gsap.fromTo(
          batch,
          { opacity: 0, y: 80, scale: 0.9 },
          { opacity: 1, y: 0, scale: 1, duration: 0.9, stagger: 0.1, ease: 'back.out(1.8)', overwrite: true }
        ),
    });
  if (!sda) {
    reveal('[data-reveal]:not(.foot__logo):not(.foot__row)', 'top 85%');
    reveal('.foot__logo, .foot__row', 'top bottom');
  }

  // --- 8. Manifesto video -------------------------------------------------------------
  setupManifesto();

  // Opening a project changes the page height; re-measure so the pinned manifesto scrubs from true positions.
  const remeasure = () => {
    ScrollTrigger.refresh();
    window.setTimeout(() => ScrollTrigger.refresh(), 500); // again after the height transition
  };
  $$('details.row').forEach((d) => d.addEventListener('toggle', remeasure));

  // Nav pill follows the section in view.
  setupNav();
  setupHud();

  // GitHub numbers (static fallbacks in the markup).
  const gh = $('[data-github-stats]');
  if (gh) githubStats(gh).finally(() => ScrollTrigger.refresh()); // graph changes page height

}

// --- 3. Hero ----------------------------------------------------------------------------------
// The name is a row of letter tiles. They drop in with a bounce when the loader lifts, hop away from the
// pointer, and fall off the bottom of the screen one after another as you scroll.
function setupHero() {
  const title = $('.hero__title');
  const letters = [...title.textContent!].map((ch) => {
    const el = document.createElement('span');
    if (ch === ' ') el.className = 'sp';
    el.textContent = ch === ' ' ? '\u00a0' : ch;
    return el;
  });
  title.replaceChildren(...letters);

  if (reduced) {
    ScrollTrigger.create({
      trigger: hero,
      start: 0,
      end: 'bottom 6%',
      onUpdate: (st) => header.classList.toggle('is-dark', st.progress < 1),
    });
    return;
  }

  const pointer = { x: -9999, y: -9999 };
  window.addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });
  let on = true;
  new IntersectionObserver(([e]) => (on = e.isIntersecting)).observe(hero);
  const type = $('[data-hero-type]');
  const range = (a: number, b: number, x: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  // Per-tile state: the intro drop (dy, dr), the pointer hop (y, r) and the spin it picks up on the way down.
  const st = letters.map(() => ({ dy: -innerHeight * 1.4, dr: gsap.utils.random(-70, 70), y: 0, r: 0, spin: gsap.utils.random(-38, 38) }));
  heroDrop = () => {
    gsap.to(
      st.filter((_, i) => !letters[i].classList.contains('sp')),
      { dy: 0, dr: 0, duration: 1.6, ease: 'bounce.out', stagger: 0.075 }
    );
  };
  // The scroll position is eased once, here, so the fall glides instead of following every wheel tick.
  let target = 0; // the hero's scroll progress, 0..1
  let eased = 0;
  gsap.ticker.add((_t, dtMs) => {
    eased += (target - eased) * (1 - Math.exp((-dtMs / 1000) * 8));
    if (!on) return;
    const hits = letters.map((el) => el.getBoundingClientRect());
    letters.forEach((el, i) => {
      const r = hits[i];
      const s = st[i];
      const dx = pointer.x - (r.left + r.width / 2);
      const dy = pointer.y - (r.top + r.height / 2);
      const k = eased > 0.02 ? 0 : Math.max(0, 1 - Math.hypot(dx, dy) / 240);
      // Tiles hop up and tilt away when the pointer comes close.
      s.y += (-k * k * r.height * 0.28 - s.y) * 0.18;
      s.r += (-Math.sign(dx) * k * 16 - s.r) * 0.18;
      // Gravity: each tile lets go a little after its neighbour and accelerates downwards.
      const q = range(0.04 + i * 0.03, 0.62 + i * 0.03, eased);
      const fall = q * q * innerHeight * 1.5;
      // The tiles fan out a little as they fall, outer letters furthest, so they never pile into one clump.
      const fan = ((i - (letters.length - 1) / 2) / letters.length) * q * innerWidth * 0.35;
      el.style.transform = `translate(${fan.toFixed(1)}px, ${(s.dy + s.y + fall).toFixed(1)}px) rotate(${(s.dr + s.r + q * s.spin).toFixed(2)}deg)`;
    });
  });

  // Scroll: the status line clears first. The facts and the intro need no fade at all, since the
  // next section slides up over the pinned hero and covers them.
  const tl = gsap.timeline({ defaults: { ease: 'power1.inOut' } });
  tl.to('[data-hero-status]', { opacity: 0, duration: 0.14 }, 0);
  tl.to({}, { duration: 1 }, 0); // the timeline spans the whole pin
  ScrollTrigger.create({
    trigger: hero,
    start: 'top top',
    end: '+=100%',
    pin: true,
    pinSpacing: false, // the next section slides up over the pinned hero: no empty scroll
    scrub: 0.6,
    animation: tl,
    onUpdate: (s) => {
      target = s.progress;
      type.classList.toggle('is-gone', s.progress > 0.985);
    },
  });
}

// --- 4. First principles: build, break, rebuild ---------------------------------------------
// One pinned beat of about 1.6 screens. BUILD rises letter by letter, BREAK drops apart,
// REBUILD flies back together. Scroll scrubs the whole thing, so it never plays faster than you scroll.
function setupWall() {
  const pin = $('[data-wall-pin]');
  const stage = $('.wall__stage', pin);
  const words = $$('[data-word]', pin);
  const notes = $$('.wall__note span', pin);
  const texts = words.map((w) => [...(w.textContent ?? '')]);

  // Plain tiles for the no-motion layout: every word stacked, each letter its own tile.
  words.forEach((w, k) => {
    w.textContent = '';
    w.style.setProperty('--n', String(texts[k].length));
    texts[k].forEach((c) => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = c;
      w.append(s);
    });
  });
  if (reduced) return;

  // With motion, one row of tiles does all three words. Each tile is a little reel holding that
  // position's letter from BUILD, BREAK and REBUILD; scroll rolls every reel to the next word.
  const mk = (cls: string) => {
    const e = document.createElement('span');
    e.className = cls;
    return e;
  };
  const N = Math.max(...texts.map((t) => t.length));
  words.forEach((w) => (w.style.display = 'none'));
  const reel = document.createElement('div');
  reel.className = 'reel';
  reel.style.setProperty('--n', String(N));
  const tiles = Array.from({ length: N }, (_, i) => {
    const tile = mk('tile');
    const face = mk('tile__face');
    const win = mk('tile__win');
    const strip = mk('tile__strip');
    texts.forEach((t) => {
      const c = mk('tile__ch');
      c.textContent = t[i] ?? '\u00a0';
      strip.append(c);
    });
    win.append(strip);
    face.append(win);
    tile.append(face);
    reel.append(tile);
    return { tile, face, strip };
  });
  stage.append(reel);

  const here = (i: number, phase: number) => texts[phase]?.[i] !== undefined;
  const faces = tiles.map((t) => t.face);
  const r = gsap.utils.random;
  const TW = '0.9em';

  // Tiles the first word does not use start collapsed.
  tiles.forEach(({ tile, face }, i) => {
    if (!here(i, 0)) gsap.set(tile, { width: 0 });
    if (!here(i, 0)) gsap.set(face, { scale: 0, opacity: 0 });
  });

  const T_BREAK = 2.0; // BUILD rolls into BREAK
  const T_REBUILD = 5.0; // the pieces roll into REBUILD
  const tl = gsap.timeline({ defaults: { ease: 'none' } });

  // Enter: the tiles rise into place one after another.
  tl.from(
    tiles.filter((_, i) => here(i, 0)).map((t) => t.face),
    { yPercent: 70, scale: 0.6, opacity: 0, rotation: () => r(-10, 10), duration: 1, stagger: 0.12, ease: 'power3.out' },
    0
  );

  // Roll every reel to the next word; tiles that appear or vanish between words grow or shrink.
  const roll = (phase: number, at: number) => {
    tiles.forEach(({ tile, face, strip }, i) => {
      const delay = i * 0.07;
      tl.to(strip, { yPercent: -(100 / texts.length) * phase, duration: 1, ease: 'power2.inOut' }, at + delay);
      const was = here(i, phase - 1);
      const now = here(i, phase);
      if (now && !was) {
        tl.to(tile, { width: TW, duration: 0.9, ease: 'power2.inOut' }, at + delay);
        tl.to(face, { scale: 1, opacity: 1, duration: 0.9, ease: 'power2.inOut' }, at + delay);
      } else if (was && !now) {
        tl.to(tile, { width: 0, duration: 0.9, ease: 'power2.inOut' }, at + delay);
        tl.to(face, { scale: 0, opacity: 0, duration: 0.9, ease: 'power2.inOut' }, at + delay);
      }
    });
  };
  roll(1, T_BREAK);
  // BREAK: the tiles drift apart and tilt, slowly, as if the word was losing its grip.
  tl.to(faces, { x: () => r(-26, 26), y: () => r(18, 70), rotation: () => r(-9, 9), duration: 1.5, stagger: { each: 0.06, from: 'random' }, ease: 'power2.inOut' }, T_BREAK + 1.2);
  // REBUILD: they drift back together while the reels roll to the new word.
  tl.to(faces, { x: 0, y: 0, rotation: 0, duration: 1.4, stagger: { each: 0.05, from: 'center' }, ease: 'power3.inOut' }, T_REBUILD - 0.3);
  roll(2, T_REBUILD);
  tl.to({}, { duration: 0.8 }, '>'); // hold the finished word

  const total = tl.duration();
  let note = 0;
  ScrollTrigger.create({
    trigger: pin,
    start: 'top top',
    end: '+=230%',
    pin: true,
    scrub: 1,
    animation: tl,
    invalidateOnRefresh: true,
    onUpdate: (st) => {
      const t = st.progress * total;
      const next = t < T_BREAK ? 0 : t < T_REBUILD ? 1 : 2;
      if (next === note) return;
      note = next;
      notes.forEach((n, i) => n.classList.toggle('is-active', i === next));
    },
  });
}

// --- 7. Selected work ------------------------------------------------------------------------
// The list scrolls normally; the preview beside it is sticky and wipes to the project that is
// passing the reading line. No pin, so the section is only as long as the list itself.
function setupWork() {
  const shots = $$('[data-shot]');
  const items = $$('[data-item]');
  const counter = $('[data-work-index]');
  const bar = $('[data-work-bar]');
  let index = 0;

  // The photos form a neat pile: the current one lies on top, the ones already seen stay underneath,
  // each turned a few degrees the other way and nudged aside; the ones to come wait above and drop in.
  const lay = () => {
    shots.forEach((s, k) => {
      const d = index - k; // > 0: already seen, 0: current, < 0: still to come
      let x = 0, y = 0, r = 0, sc = 1, o = 1;
      if (d > 0) {
        const side = k % 2 ? 1 : -1;
        x = side * (5 + d * 3);
        y = d * 6;
        r = side * (1.2 + d * 1);
        sc = 1 - d * 0.015;
        o = d > 4 ? 0 : 1;
      } else if (d < 0) {
        y = -120;
        r = (k % 2 ? 1 : -1) * 14;
        sc = 1.08;
        o = 0;
      } else r = k % 2 ? 0.8 : -0.8;
      s.style.setProperty('--x', `${x}px`);
      s.style.setProperty('--y', d < 0 ? `${y}%` : `${y}px`);
      s.style.setProperty('--r', `${r}deg`);
      s.style.setProperty('--s', String(sc));
      s.style.opacity = String(o);
      s.style.zIndex = String(10 - Math.abs(d) + (d >= 0 ? 10 : 0));
      s.classList.toggle('is-active', d === 0);
    });
  };
  lay();

  const show = (i: number) => {
    if (i === index) return;
    index = i;
    lay();
    items.forEach((it, k) => it.classList.toggle('is-active', k === i));
    counter.textContent = String(i + 1).padStart(2, '0');
  };

  // The reading line sits a little below the middle. Whichever item it crosses is current;
  // above or below the list it clamps to the first or last, so a fast jump never leaves a stale one.
  ScrollTrigger.create({
    trigger: '.work__list',
    start: 'top bottom',
    end: 'bottom top',
    onUpdate: () => {
      const line = innerHeight * 0.58;
      const next = items.findIndex((it) => it.getBoundingClientRect().bottom > line);
      show(next < 0 ? items.length - 1 : next);
    },
  });
  ScrollTrigger.create({
    trigger: '.work__list',
    start: 'top 58%',
    end: 'bottom 58%',
    onUpdate: (s) => (bar.style.transform = `scaleX(${s.progress.toFixed(4)})`),
  });

  // A project opens its case study in the index below.
  const open = (href: string | null, e?: Event) => {
    const row = href ? (document.getElementById(href.slice(1)) as HTMLDetailsElement | null) : null;
    if (!row) return;
    e?.preventDefault();
    row.open = true;
    row.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  };
  $$<HTMLAnchorElement>('.work__item a').forEach((a) => a.addEventListener('click', (e) => open(a.getAttribute('href'), e)));
  $('.work__view').addEventListener('click', () => open(items[index].querySelector('a')!.getAttribute('href')));
}

// --- 8. Manifesto -----------------------------------------------------------------------------
function setupManifesto() {
  const section = $('[data-manifesto]');
  const pin = $('[data-manifesto-pin]');
  const frame = $('[data-manifesto-frame]');
  const video = $<HTMLVideoElement>('[data-manifesto-video]');
  const drum = $('[data-wheel]');
  const words = $$('.wheel__word', drum);

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

  // Tag words on a drum: each word is placed from its offset to the centre, so the
  // centre word is full size and its neighbours squash, shrink and fade toward the
  // rim. Scroll sets a target (with a dwell per word); a ticker eases toward it.
  const WHEEL_START = 0.04;
  const WHEEL_END = 0.74;
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
      w.style.opacity = '1'; // full strength; the wheel's edge mask does the fading
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

  // 1. Entrance, on time, not on scroll: the window swings in and the quote drops beside it as the
  //    section comes into view, so both have settled by the time the section pins.
  const quote = '.manifesto__quote';
  gsap.fromTo(frame, { scale: 0.8, rotation: 6, y: 110, opacity: 0 }, {
    scale: 1, rotation: -2, y: 0, opacity: 1, duration: 1.1, ease: 'power3.out',
    scrollTrigger: { trigger: section, start: 'top 75%', toggleActions: 'play none none reverse' },
  });
  gsap.fromTo(quote, { y: -80, opacity: 0, rotation: -5 }, {
    y: 0, opacity: 1, rotation: 0, duration: 0.9, delay: 0.2, ease: 'power3.out',
    scrollTrigger: { trigger: section, start: 'top 75%', toggleActions: 'play none none reverse' },
  });

  // 2. Scroll-scrubbed: the whole pin is one clock from 0 to 1.
  //    0.04 to 0.74  the tag wheel turns through its words, one settling at a time
  //    0.76 to 0.84  quote and wheel leave
  //    0.78 to 1.00  the window turns away and shrinks while the profile rises over it
  const tl = gsap.timeline({ defaults: { ease: 'none' } });
  tl.to({}, { duration: 1 }, 0)
    .fromTo(
      [quote, '.wheel'],
      { opacity: 1, y: 0 },
      { opacity: 0, y: -40, duration: 0.08, ease: 'power2.in', immediateRender: false },
      0.76
    )
    .fromTo(
      frame,
      { scale: 1, rotation: -2, y: 0 },
      { scale: 0.7, rotation: -9, y: -30, duration: 0.22, ease: 'power2.inOut', immediateRender: false },
      0.78
    );

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: 'bottom bottom',
    pin,
    pinSpacing: false,
    scrub: 1,
    animation: tl,
    invalidateOnRefresh: true,
    onUpdate: (st) => (wheel.target = dwell(Math.min(1, Math.max(0, (st.progress - WHEEL_START) / (WHEEL_END - WHEEL_START))) * (n - 1), n)),
  });
}

// --- Nav pill ------------------------------------------------------------------------------------
function setupNav() {
  const pill = $('[data-pill]');
  const slide = $('.pill__slide', pill);
  const links = $$<HTMLAnchorElement>('[data-nav]', pill);
  // Page order -> nav key; the last section whose top is above mid-screen wins (same rule as the HUD).
  const sections: [string, string][] = [
    ['[data-values]', 'about'], ['[data-projects]', 'work'], ['.index', 'work'], ['.notes', 'work'],
    ['[data-manifesto]', 'about'], ['.profile', 'about'], ['[data-foot]', 'contact'],
  ];
  const els = sections.map(([sel]) => $(sel));
  let current: string | undefined | null = null;
  const paint = (force = false) => {
    let key: string | undefined;
    els.forEach((el, i) => {
      if (el.getBoundingClientRect().top < innerHeight * 0.5) key = sections[i][1];
    });
    if (scrollY + innerHeight >= document.documentElement.scrollHeight - 2) key = 'contact';
    if (key === current && !force) return;
    current = key;
    links.forEach((l) => l.classList.toggle('is-active', l.dataset.nav === key));
    const active = links.find((l) => l.dataset.nav === key);
    pill.classList.toggle('has-active', !!active);
    if (active) {
      slide.style.width = `${active.offsetWidth}px`;
      slide.style.transform = `translateX(${active.offsetLeft}px)`;
    }
  };
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: () => paint() });
  ScrollTrigger.addEventListener('refresh', () => paint(true));
  paint(true);
}

// --- HUD: scroll position and the section in view ---------------------------------------------------
function setupHud() {
  const pct = document.querySelector<HTMLElement>('[data-hud-pct]');
  const name = document.querySelector<HTMLElement>('[data-hud-name]');
  const bar = document.querySelector<HTMLElement>('[data-hud-bar]');
  if (!pct || !name || !bar) return;
  const sections: [string, string][] = [
    ['[data-hero]', 'Intro'], ['[data-wall]', 'Principles'], ['[data-rows]', 'Index'], ['[data-values]', 'About'],
    ['[data-projects]', 'Work'], ['.index', 'Case studies'], ['.notes', 'Notes'], ['[data-manifesto]', 'Manifesto'],
    ['.profile', 'Profile'], ['[data-foot]', 'Contact'],
  ];
  const els = sections.map(([sel]) => document.querySelector<HTMLElement>(sel));
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: (s) => {
      pct.textContent = String(Math.round(s.progress * 100)).padStart(3, '0');
      bar.style.transform = `scaleX(${s.progress.toFixed(4)})`;
      let label = sections[0][1];
      els.forEach((el, i) => {
        if (el && el.getBoundingClientRect().top < innerHeight * 0.5) label = sections[i][1];
      });
      if (name.textContent !== label) name.textContent = label;
    },
  });
}

boot();
