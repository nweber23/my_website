/**
 * Niklas Weber — Portfolio
 * Close to the Metal · 2026
 */

(function () {
    'use strict';

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(pointer: fine)').matches;

    /* ===== Scroll progress — top hairline + rail meter + hex address ===== */
    class ScrollProgress {
        constructor() {
            this.bar = document.querySelector('.scroll-progress');
            this.meter = document.querySelector('.rail__meter-fill');
            this.hex = document.querySelector('.rail__hex');
            if (!this.bar && !this.meter && !this.hex) return;
            this.ticking = false;
            window.addEventListener('scroll', () => this.request(), { passive: true });
            window.addEventListener('resize', () => this.request(), { passive: true });
            this.update();
        }
        request() {
            if (this.ticking) return;
            this.ticking = true;
            requestAnimationFrame(() => this.update());
        }
        update() {
            const doc = document.documentElement;
            const scrolled = doc.scrollTop || document.body.scrollTop;
            const height = doc.scrollHeight - doc.clientHeight;
            const t = height > 0 ? Math.min(1, scrolled / height) : 0;
            if (this.bar) this.bar.style.transform = 'scaleX(' + t + ')';
            if (this.meter) this.meter.style.transform = 'scaleY(' + t + ')';
            if (this.hex) {
                const addr = Math.round(t * 0xFFFF);
                this.hex.textContent = '0x' + addr.toString(16).toUpperCase().padStart(4, '0');
            }
            this.ticking = false;
        }
    }

    /* ===== Nav active link tracking ===== */
    class NavTracker {
        constructor() {
            this.sections = document.querySelectorAll('.section[id]');
            this.links = document.querySelectorAll('.nav__link');
            if (!this.sections.length || !this.links.length) return;

            this.observer = new IntersectionObserver(
                entries => this.handle(entries),
                { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
            );
            this.sections.forEach(s => this.observer.observe(s));
        }
        handle(entries) {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const id = entry.target.id;
                this.links.forEach(link => {
                    const active = link.getAttribute('href') === '#' + id;
                    link.classList.toggle('is-active', active);
                });
            });
        }
    }

    /* ===== Live time display ===== */
    class NavTime {
        constructor() {
            this.el = document.querySelector('.nav__time');
            if (!this.el) return;
            this.update();
            setInterval(() => this.update(), 30000);
        }
        update() {
            this.el.textContent = new Date().toLocaleTimeString('de-DE', {
                hour: '2-digit', minute: '2-digit', hour12: false,
                timeZone: 'Europe/Berlin'
            }) + ' CET';
        }
    }

    /* ===== Scroll reveal ===== */
    class ScrollReveal {
        constructor() {
            this.els = document.querySelectorAll('[data-reveal]');
            if (!this.els.length) return;

            this.observer = new IntersectionObserver(
                entries => {
                    entries.forEach(e => {
                        if (!e.isIntersecting) return;
                        e.target.classList.add('is-visible');
                        this.observer.unobserve(e.target);
                    });
                },
                { rootMargin: '0px 0px -80px 0px', threshold: 0.06 }
            );
            this.els.forEach(el => this.observer.observe(el));
        }
    }

    /* ===== Skills stagger reveal ===== */
    class SkillsReveal {
        constructor() {
            const block = document.querySelector('.about__skills');
            if (!block) return;
            const observer = new IntersectionObserver(entries => {
                entries.forEach(e => {
                    if (!e.isIntersecting) return;
                    block.classList.add('is-visible');
                    observer.disconnect();
                });
            }, { threshold: 0.15 });
            observer.observe(block);
        }
    }

    /* ===== Decode (scramble) effect on mono labels ===== */
    class Decode {
        constructor() {
            this.els = document.querySelectorAll('[data-decode]');
            if (!this.els.length) return;
            if (prefersReducedMotion) return;

            this.CHARS = '<>/\\[]{}=+*#01';
            const obs = new IntersectionObserver(entries => {
                entries.forEach(e => {
                    if (!e.isIntersecting) return;
                    this.run(e.target);
                    obs.unobserve(e.target);
                });
            }, { threshold: 0.4 });
            this.els.forEach(el => obs.observe(el));
        }

        run(el) {
            const original = el.textContent;
            const len = original.length;
            const dur = 700;
            const t0 = performance.now();

            const step = now => {
                const t = Math.min(1, (now - t0) / dur);
                const settled = Math.floor(t * len);
                let out = original.slice(0, settled);
                for (let i = settled; i < len; i++) {
                    const ch = original[i];
                    out += (ch === ' ') ? ' '
                        : this.CHARS[(Math.random() * this.CHARS.length) | 0];
                }
                el.textContent = out;
                if (t < 1) requestAnimationFrame(step);
                else el.textContent = original;
            };
            requestAnimationFrame(step);
        }
    }

    /* ===== Scrub engine — pointer-independent scroll parallax ===== */
    class Scrub {
        constructor() {
            if (prefersReducedMotion) return;
            this.els = Array.from(document.querySelectorAll('[data-scrub]')).map(el => ({
                el, speed: parseFloat(el.dataset.scrub) || 0.08
            }));
            if (!this.els.length) return;
            if (window.matchMedia('(max-width: 900px)').matches) return;

            this.ticking = false;
            window.addEventListener('scroll', () => this.request(), { passive: true });
            window.addEventListener('resize', () => this.request(), { passive: true });
            this.update();
        }
        request() {
            if (this.ticking) return;
            this.ticking = true;
            requestAnimationFrame(() => this.update());
        }
        update() {
            const vh = window.innerHeight;
            for (const item of this.els) {
                const r = item.el.getBoundingClientRect();
                const center = r.top + r.height / 2;
                const delta = (center - vh / 2) * item.speed;
                item.el.style.transform = 'translate3d(0,' + delta.toFixed(1) + 'px,0)';
            }
            this.ticking = false;
        }
    }

    /* ===== Crosshair cursor telemetry ===== */
    class Crosshair {
        constructor() {
            if (prefersReducedMotion || !finePointer) return;
            this.root = document.querySelector('.xhair');
            if (!this.root) return;
            this.v = this.root.querySelector('.xhair__v');
            this.h = this.root.querySelector('.xhair__h');
            this.tag = this.root.querySelector('.xhair__tag');

            this.x = -1; this.y = -1;       // current (lerped)
            this.tx = -1; this.ty = -1;     // target
            this.running = false;

            document.addEventListener('pointermove', e => this.onMove(e), { passive: true });
            document.addEventListener('pointerleave', () => this.root.classList.remove('is-on'));
        }
        onMove(e) {
            if (this.tx < 0) { this.x = e.clientX; this.y = e.clientY; }
            this.tx = e.clientX;
            this.ty = e.clientY;
            this.root.classList.add('is-on');
            this.start();
        }
        start() {
            if (this.running) return;
            this.running = true;
            const tick = () => {
                this.x += (this.tx - this.x) * 0.22;
                this.y += (this.ty - this.y) * 0.22;
                this.v.style.transform = 'translateX(' + this.x.toFixed(1) + 'px)';
                this.h.style.transform = 'translateY(' + this.y.toFixed(1) + 'px)';
                this.tag.style.transform =
                    'translate(' + (this.x + 12).toFixed(1) + 'px,' + (this.y + 12).toFixed(1) + 'px)';
                this.tag.textContent =
                    'X:' + String(Math.round(this.x)).padStart(4, '0') +
                    ' Y:' + String(Math.round(this.y)).padStart(4, '0');

                if (Math.abs(this.tx - this.x) < 0.3 && Math.abs(this.ty - this.y) < 0.3) {
                    this.running = false;
                    return;
                }
                requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        }
    }

    /* ===== Mobile navigation ===== */
    class MobileNav {
        constructor() {
            this.nav = document.querySelector('.nav');
            this.toggle = document.querySelector('.nav__toggle');
            this.links = document.querySelectorAll('.nav__link');
            if (!this.nav || !this.toggle) return;

            this.open = false;
            this.toggle.addEventListener('click', () => this.handleToggle());
            this.links.forEach(l => l.addEventListener('click', () => this.open && this.close()));
            document.addEventListener('keydown', e => e.key === 'Escape' && this.open && this.close());
            window.matchMedia('(min-width: 901px)').addEventListener('change', e => e.matches && this.open && this.close());
        }
        handleToggle() { this.open ? this.close() : this.doOpen(); }
        doOpen() {
            this.open = true;
            this.nav.classList.add('nav--open');
            this.toggle.setAttribute('aria-expanded', 'true');
            this.toggle.setAttribute('aria-label', 'Close menu');
            document.body.classList.add('nav-open');
        }
        close() {
            this.open = false;
            this.nav.classList.remove('nav--open');
            this.toggle.setAttribute('aria-expanded', 'false');
            this.toggle.setAttribute('aria-label', 'Open menu');
            document.body.classList.remove('nav-open');
        }
    }

    /* ===== Smooth scroll ===== */
    class SmoothScroll {
        constructor() {
            document.querySelectorAll('a[href^="#"]').forEach(link => {
                link.addEventListener('click', e => {
                    const href = link.getAttribute('href');
                    if (!href || href.length < 2) return;
                    const target = document.querySelector(href);
                    if (!target) return;
                    e.preventDefault();
                    const offset = target.getBoundingClientRect().top + window.pageYOffset - 80;
                    window.scrollTo({ top: offset, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
                    history.pushState(null, '', href);
                });
            });
        }
    }

    /* ===== External link safety ===== */
    class ExternalLinks {
        constructor() {
            document.querySelectorAll('a[target="_blank"]').forEach(a => {
                if (!a.hasAttribute('rel')) a.setAttribute('rel', 'noopener noreferrer');
            });
        }
    }

    /* ===== Interactive hero — width-axis name + ember glow =====
       Each character's Archivo `wdth` stretches toward the cursor
       (100 → 125) and the whole name compresses as you scroll away. */
    class HeroInteractive {
        constructor() {
            if (prefersReducedMotion) return;

            this.hero = document.querySelector('.hero');
            this.name = document.querySelector('.hero__name');
            if (!this.hero || !this.name) return;
            if (this.hero.classList.contains('hero--compact')) return;

            this.chars = [];
            if (finePointer) this.splitChars();

            this.gx = 50; this.gy = 40;     // glow position (%)
            this.tgx = 50; this.tgy = 40;
            this.px = -1; this.py = -1;     // pointer, -1 = inactive
            this.squeeze = 0;               // scroll compression 0..1
            this.running = false;
            this.RADIUS = 260;

            if (finePointer) {
                this.measure();
                this.hero.addEventListener('pointerenter', () => this.measure(), { passive: true });
                this.hero.addEventListener('pointermove', e => this.onMove(e), { passive: true });
                this.hero.addEventListener('pointerleave', () => this.onLeave(), { passive: true });
                window.addEventListener('resize', () => this.measure(), { passive: true });
            }
            window.addEventListener('scroll', () => this.onScroll(), { passive: true });
        }

        splitChars() {
            this.name.querySelectorAll('.hero__name-line').forEach(line => {
                const text = line.textContent;
                line.textContent = '';
                for (const ch of text) {
                    const span = document.createElement('span');
                    span.className = 'hero__char';
                    span.textContent = ch;
                    line.appendChild(span);
                    this.chars.push(span);
                }
            });
        }

        measure() {
            this.centers = this.chars.map(span => {
                const r = span.getBoundingClientRect();
                return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            });
        }

        onMove(e) {
            const rect = this.hero.getBoundingClientRect();
            this.px = e.clientX;
            this.py = e.clientY;
            this.tgx = ((e.clientX - rect.left) / rect.width) * 100;
            this.tgy = ((e.clientY - rect.top) / rect.height) * 100;
            this.start();
        }

        onLeave() {
            this.px = -1; this.py = -1;
            this.tgx = 50; this.tgy = 40;
            this.start();
        }

        onScroll() {
            const h = this.hero.offsetHeight || 1;
            const t = Math.min(1, Math.max(0, window.scrollY / (h * 0.9)));
            if (Math.abs(t - this.squeeze) < 0.005) return;
            this.squeeze = t;
            // squeeze the whole name as the hero scrolls out
            this.name.style.fontVariationSettings =
                '"wdth" ' + (105 - t * 35).toFixed(1) + ', "wght" ' + Math.round(800 - t * 200);
            this.name.style.opacity = (1 - t * 0.55).toFixed(3);
            if (this.chars.length && this.px >= 0) this.measure();
        }

        start() {
            if (this.running) return;
            this.running = true;
            const tick = () => {
                this.gx += (this.tgx - this.gx) * 0.12;
                this.gy += (this.tgy - this.gy) * 0.12;
                this.hero.style.setProperty('--glow-x', this.gx.toFixed(2) + '%');
                this.hero.style.setProperty('--glow-y', this.gy.toFixed(2) + '%');
                this.updateChars();

                const settled = Math.abs(this.tgx - this.gx) < 0.05 &&
                                Math.abs(this.tgy - this.gy) < 0.05;
                if (settled && this.px === -1) { this.running = false; return; }
                requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        }

        updateChars() {
            for (let i = 0; i < this.chars.length; i++) {
                let wdth = 100, wght = 800;
                if (this.px >= 0 && this.centers[i]) {
                    const c = this.centers[i];
                    const d = Math.hypot(this.px - c.x, this.py - c.y);
                    const t = Math.max(0, 1 - d / this.RADIUS);
                    wdth = 100 + t * 25;    // 100 → 125 near cursor
                    wght = 800 + t * 100;   // 800 → 900 near cursor
                }
                this.chars[i].style.fontVariationSettings =
                    '"wdth" ' + wdth.toFixed(1) + ', "wght" ' + Math.round(wght);
            }
        }
    }

    /* ===== Metric count-up on reveal ===== */
    class MetricCountUp {
        constructor() {
            const projects = document.querySelectorAll('.project');
            if (!projects.length) return;
            const obs = new IntersectionObserver(entries => {
                entries.forEach(e => {
                    if (!e.isIntersecting) return;
                    e.target.querySelectorAll('.project__metric dd').forEach(dd => this.animate(dd));
                    obs.unobserve(e.target);
                });
            }, { threshold: 0.25 });
            projects.forEach(p => obs.observe(p));
        }

        animate(dd) {
            const raw = dd.textContent.trim();
            const m = raw.match(/^(\D*?)(\d+(?:\.\d+)?)(.*)$/s);
            if (!m) return;                       // no numeric portion — leave untouched
            if (prefersReducedMotion) { dd.textContent = raw; return; }

            const prefix = m[1];
            const target = parseFloat(m[2]);
            const suffix = m[3];
            const decimals = (m[2].split('.')[1] || '').length;
            const dur = 1100;
            const ease = t => 1 - Math.pow(1 - t, 3);
            const t0 = performance.now();

            const step = now => {
                const t = Math.min(1, (now - t0) / dur);
                dd.textContent = prefix + (target * ease(t)).toFixed(decimals) + suffix;
                if (t < 1) requestAnimationFrame(step);
                else dd.textContent = raw;
            };
            dd.textContent = prefix + (0).toFixed(decimals) + suffix;
            requestAnimationFrame(step);
        }
    }

    /* ===== Init ===== */
    function init() {
        new ScrollProgress();
        new NavTracker();
        new NavTime();
        new ScrollReveal();
        new SkillsReveal();
        new Decode();
        new Scrub();
        new Crosshair();
        new SmoothScroll();
        new MobileNav();
        new ExternalLinks();
        new HeroInteractive();
        new MetricCountUp();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
