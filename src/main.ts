import '@fontsource-variable/inter';
import '@fontsource/anton';
import '@fontsource/space-mono/400.css';
import '@fontsource/rock-salt';
import './styles/base.css';
import './styles/home.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { POSTERS, paperCanvas, posterCanvas } from './poster/textures';
import { PosterBox } from './poster/box';
import { Letters, type LetterCue } from './poster/letters';
import { DotMatrix } from './poster/dots';
import { githubStats } from './shared/github';

gsap.registerPlugin(ScrollTrigger);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduced) document.documentElement.classList.add('is-reduced');

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];
const EASE = 'expo.out'; // closest GSAP curve to cubic-bezier(0.16, 1, 0.3, 1)
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
  private fill = $('[data-loader-fill]');
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
    this.fill.style.width = `${(Math.floor(this.shown / (100 / 24)) * 100) / 24}%`;
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
  // Steps: fonts, one per poster, paper, WebGL, dot matrix.
  const loader = new Loader(POSTERS.length + 4);

  // Fonts the canvases need.
  await Promise.all([
    document.fonts.load('400 40px "Anton"'),
    document.fonts.load('400 16px "Space Mono"'),
    document.fonts.load('400 20px "Rock Salt"'),
  ]).catch(() => {});
  loader.step();

  // Posters for the 3D box, one per frame so the counter keeps moving.
  const posters: HTMLCanvasElement[] = [];
  for (const spec of POSTERS) {
    await nextFrame();
    posters.push(posterCanvas(spec));
    loader.step();
  }

  // Full-bleed crinkled paper for the poster wall and the values section.
  await nextFrame();
  const paper = paperCanvas(1600, 1000, 19).toDataURL('image/jpeg', 0.86);
  $('[data-paper]').style.backgroundImage = `url(${paper})`;
  $('[data-values]').style.backgroundImage = `url(${paper})`;
  $('[data-values]').style.backgroundSize = 'cover';
  loader.step();

  let box: PosterBox | null = null;
  let letters: Letters | null = null;
  try {
    box = new PosterBox($<HTMLCanvasElement>('[data-gl-box]'), $('[data-hero-stage]'), posters);
    letters = new Letters($<HTMLCanvasElement>('[data-gl-letters]'), reduced);
  } catch (err) {
    console.warn('WebGL unavailable, continuing without 3D', err);
  }
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

  setupMotion({ box, letters, dots, lenis });

  await loader.finished();
  await intro(loaderEl, box);
  lenis?.start();
  ScrollTrigger.refresh();
}

/** Loader text drops out, then the navy sheet is pulled up off the page. */
function intro(loaderEl: HTMLElement, box: PosterBox | null) {
  const tl = gsap.timeline();
  const kids = $$('.loader__center, .loader__text', loaderEl);
  const strips = $$('[data-strips] i');
  gsap.set([header, '[data-hero-intro]', '[data-infocard]', '[data-hero-hint]'], { opacity: 0, y: 12 });
  gsap.set(strips, { opacity: 0, y: 18, filter: 'blur(12px)' });
  if (reduced) {
    loaderEl.remove();
    gsap.set([header, '[data-hero-intro]', '[data-infocard]', '[data-hero-hint]', ...strips], { opacity: 1, y: 0, filter: 'none' });
    if (box) gsap.set(box.element, { opacity: 1 });
    gsap.set('[data-gl-letters]', { opacity: 1 });
    return Promise.resolve();
  }
  tl.to(kids, { yPercent: 40, opacity: 0, duration: 0.5, stagger: 0.06, ease: 'power3.in' })
    .to(loaderEl, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.9, ease: 'expo.inOut' }, '-=0.1')
    .set(loaderEl, { display: 'none' })
    .to(box ? box.element : {}, { opacity: 1, duration: 1.1, ease: EASE }, '-=0.45')
    .to(strips, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.1, stagger: 0.1, ease: EASE }, '<')
    .to('[data-gl-letters]', { opacity: 1, duration: 0.01 }, '<')
    .to([header, '[data-hero-intro]', '[data-infocard]', '[data-hero-hint]'], { opacity: 1, y: 0, duration: 1, stagger: 0.08, ease: EASE }, '-=0.6');
  return tl.then();
}

// =========================================================================
// 2–9. MOTION
// =========================================================================

interface Stage {
  box: PosterBox | null;
  letters: Letters | null;
  dots: DotMatrix;
  lenis: Lenis | null;
}

function setupMotion({ box, letters, dots, lenis }: Stage) {
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

  // --- 3. Hero: pinned 3D poster box ---------------------------------------
  if (!reduced) {
    const fade = gsap.timeline({ defaults: { ease: 'none' } });
    fade
      .to(['[data-hero-intro]', '[data-infocard]'], { opacity: 0.35, duration: 0.12 })
      .to(['[data-hero-intro]', '[data-infocard]', '[data-hero-hint]', '[data-strips]'], { opacity: 0, y: 20, duration: 0.14 }, 0.16)
      // Pad to 1 so the fades happen in the first third of the pinned scroll.
      .to({}, { duration: 0.7 });
    ScrollTrigger.create({
      trigger: hero,
      start: 'top top',
      end: '+=200%',
      pin: true,
      scrub: true,
      animation: fade,
      onUpdate: (s) => box && (box.progress = s.progress),
    });
  }

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
  const values = $('[data-values]');
  const track = $('[data-values-track]');
  let trackTween: gsap.core.Tween | null = null;
  const fadeLayer = document.createElement('div');
  fadeLayer.style.cssText = 'position:absolute;inset:0;background:var(--bg-gradient);opacity:0;pointer-events:none;';
  values.prepend(fadeLayer);
  if (!reduced) {
    const dist = () => track.scrollWidth - innerWidth;
    trackTween = gsap.to(track, {
      x: () => -dist(),
      ease: 'none',
      scrollTrigger: { trigger: values, pin: true, start: 'top top', end: () => `+=${dist()}`, scrub: 1, invalidateOnRefresh: true },
    });
    // Ghost words travel ~1.3× the track speed.
    gsap.to('[data-ghosts]', {
      x: () => -dist() * 0.3,
      ease: 'none',
      scrollTrigger: { trigger: values, start: 'top top', end: () => `+=${dist()}`, scrub: 1, invalidateOnRefresh: true },
    });
    gsap.to(fadeLayer, { opacity: 1, ease: 'none', scrollTrigger: { trigger: values, start: 'top top', end: () => `+=${dist()}`, scrub: true } });
  }
  $$('[data-panel]', values).forEach((panel, i) => {
    gsap.from(panel.children, {
      opacity: 0,
      y: 30,
      duration: 1,
      stagger: 0.12,
      ease: EASE,
      // The first panel is on screen as soon as the section pins.
      scrollTrigger: trackTween && i > 0
        ? { trigger: panel, containerAnimation: trackTween, start: 'left 60%' }
        : { trigger: values, start: 'top 60%' },
    });
  });
  const oval = $('[data-oval]');
  // Text runs around the photo's outline; the photo itself stays still.
  const ovalText = $<SVGTextPathElement>('[data-oval-text]');
  const ovalPath = $<SVGPathElement>('#ovalPath');
  const loop = ovalPath.getTotalLength() / 2;
  ovalText.setAttribute('textLength', String(loop));
  ovalText.setAttribute('lengthAdjust', 'spacing');
  if (!reduced) gsap.fromTo(ovalText, { attr: { startOffset: 0 } }, { attr: { startOffset: loop }, duration: 36, ease: 'none', repeat: -1 });
  if (trackTween) {
    gsap.fromTo(oval, { xPercent: 45, scale: 0.9 }, {
      xPercent: 0,
      scale: 1,
      ease: 'none',
      scrollTrigger: { trigger: oval.closest('[data-panel]')!, containerAnimation: trackTween, start: 'left right', end: 'center center', scrub: true },
    });
  }

  // --- 7. Projects: rotating prism ------------------------------------------------
  setupPrism();

  // Reveal for the index, notes and profile blocks.
  $$('.sec-head, .row, .notes__list li, .card, .foot__logo, .foot__row').forEach((el) => el.setAttribute('data-reveal', ''));
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 85%',
    onEnter: (batch) =>
      gsap.fromTo(
        batch,
        { opacity: 1, y: 14, clipPath: 'inset(100% 0% 0% 0%)' },
        { y: 0, clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, stagger: 0.1, ease: 'expo.out', overwrite: true, clearProps: 'clipPath' }
      ),
  });

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

  // Nav pill follows the section in view.
  setupNav();

  // Persistent pearl letters, one per section.
  const spacer = (el: Element) => (el.parentElement?.classList.contains('pin-spacer') ? el.parentElement : el);
  const cues: [string, LetterCue][] = [
    ['[data-wall]', { glyph: 'N', side: 1, x: 0.52, y: 0.12, size: 0.3 }],
    ['[data-rows]', { glyph: 'W', side: -1, x: -0.05, y: 0.18, size: 0.24 }],
    ['[data-values]', { glyph: 'O', side: 1, x: 0.74, y: 0.42, size: 0.2 }],
    ['[data-projects]', { glyph: 'C', side: -1, x: -0.66, y: 0.36, size: 0.17 }],
    ['.profile', { glyph: 'S', side: 1, x: 0.8, y: 0.5, size: 0.2 }],
  ];
  if (letters) {
    for (const [sel, cue] of cues) {
      const set = letters.add(cue);
      ScrollTrigger.create({
        trigger: spacer($(sel)),
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (s) => set(s.progress),
        onLeave: () => set(1),
        onLeaveBack: () => set(0),
      });
    }
  }

  // GitHub numbers (static fallbacks in the markup).
  const gh = $('[data-github-stats]');
  if (gh) githubStats(gh);

  // --- Render loop: draw only what is on screen ----------------------------------------
  let lettersWere = false;
  const heroEnd = () => hero.offsetTop + innerHeight * 3.2;
  gsap.ticker.add((time) => {
    const y = lenis ? lenis.scroll : scrollY;
    if (box) {
      box.visible = y < heroEnd();
      box.render();
    }
    if (letters) {
      const active = letters.active;
      if (active || lettersWere) letters.render(time);
      lettersWere = active;
    }
    if (dots.visible || reduced) dots.draw(performance.now());
  });
}

// --- 7. Prism carousel ----------------------------------------------------------------------
function setupPrism() {
  const scene = $('[data-cube-scene]');
  const prism = $('[data-cube]');
  const faces = $$('[data-face]', prism);
  const caps = $$('[data-cap]');
  const counter = $('[data-cube-index]');
  const n = faces.length;
  const step = 360 / n;
  const state = { angle: -18, tiltX: 0, tiltY: 0 };
  let radius = 0;

  const layout = () => {
    const w = prism.offsetWidth;
    radius = w / (2 * Math.tan(Math.PI / n));
    faces.forEach((f, i) => (f.style.transform = `rotateY(${i * step}deg) translateZ(${radius}px)`));
    apply();
  };
  const apply = () => {
    prism.style.transform = `translateZ(${-radius}px) rotateX(${state.tiltX}deg) rotateY(${state.angle + state.tiltY}deg)`;
  };
  layout();
  window.addEventListener('resize', layout);

  let index = 0;
  const show = (i: number) => {
    if (i === index) return;
    index = i;
    // Rest slightly off-axis so two faces are visible at a diagonal.
    gsap.to(state, { angle: -i * step - 18, duration: reduced ? 0 : 1.1, ease: 'back.inOut(1.6)', onUpdate: apply });
    caps.forEach((c, k) => c.classList.toggle('is-active', k === i));
    counter.textContent = String(i + 1).padStart(2, '0');
  };

  if (!reduced) {
    ScrollTrigger.create({
      trigger: '[data-projects-pin]',
      start: 'top top',
      end: '+=400%',
      pin: true,
      onUpdate: (s) => show(Math.min(n - 1, Math.floor(s.progress * n))),
    });
    // Subtle tilt toward the cursor.
    scene.addEventListener('pointermove', (e) => {
      const r = scene.getBoundingClientRect();
      gsap.to(state, {
        tiltX: -((e.clientY - r.top) / r.height - 0.5) * 10,
        tiltY: ((e.clientX - r.left) / r.width - 0.5) * 10,
        duration: 0.6,
        ease: 'power2.out',
        onUpdate: apply,
      });
    });
    scene.addEventListener('pointerleave', () => gsap.to(state, { tiltX: 0, tiltY: 0, duration: 0.8, onUpdate: apply }));
  } else {
    // Without the pin, let the counter and captions step with a click.
    scene.addEventListener('click', () => show((index + 1) % n));
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

  const tl = gsap.timeline({ defaults: { ease: 'none' } });
  // Tag words turn on a cylinder.
  tl.to(drum, { rotationX: (words.length - 1) * 36, duration: 0.62 }, 0)
    .to(['.manifesto__label', '.manifesto__quote', '.wheel'], { opacity: 0, duration: 0.06 }, 0.62)
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

boot();
