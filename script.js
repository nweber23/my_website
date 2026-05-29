/**
 * Niklas Weber — Portfolio
 * Technical Editorial · 2026
 */

(function () {
    'use strict';

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ===== Scroll progress ===== */
    class ScrollProgress {
        constructor() {
            this.bar = document.querySelector('.scroll-progress');
            if (!this.bar) return;
            this.ticking = false;
            window.addEventListener('scroll', () => this.request(), { passive: true });
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
            const pct = height > 0 ? Math.min(100, (scrolled / height) * 100) : 0;
            this.bar.style.transform = 'scaleX(' + (pct / 100) + ')';
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
            });
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

    /* ===== Interactive hero — pointer-reactive name + glow ===== */
    class HeroInteractive {
        constructor() {
            if (prefersReducedMotion) return;
            if (!window.matchMedia('(pointer: fine)').matches) return;

            this.hero = document.querySelector('.hero');
            this.name = document.querySelector('.hero__name');
            if (!this.hero || !this.name) return;

            this.chars = [];
            this.splitChars();
            if (!this.chars.length) return;

            this.gx = 50; this.gy = 40;     // current glow position (%)
            this.tgx = 50; this.tgy = 40;   // target glow position (%)
            this.px = -1; this.py = -1;     // pointer (viewport px), -1 = inactive
            this.running = false;
            this.RADIUS = 240;

            this.measure();
            this.hero.addEventListener('pointerenter', () => this.measure(), { passive: true });
            this.hero.addEventListener('pointermove', e => this.onMove(e), { passive: true });
            this.hero.addEventListener('pointerleave', () => this.onLeave(), { passive: true });
            window.addEventListener('resize', () => this.measure(), { passive: true });
        }

        splitChars() {
            this.name.querySelectorAll('.hero__name-line').forEach(line => {
                const base = line.classList.contains('hero__name-line--shift') ? 80 : 20;
                const text = line.textContent;
                line.textContent = '';
                for (const ch of text) {
                    const span = document.createElement('span');
                    span.className = 'hero__char';
                    span.textContent = ch;
                    span.dataset.base = base;
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
                const base = +this.chars[i].dataset.base;
                let wght = 460;
                if (this.px >= 0 && this.centers[i]) {
                    const c = this.centers[i];
                    const d = Math.hypot(this.px - c.x, this.py - c.y);
                    const t = Math.max(0, 1 - d / this.RADIUS);
                    wght = 440 + t * 260;   // 440 → 700 near cursor
                }
                this.chars[i].style.fontVariationSettings =
                    '"opsz" 144, "SOFT" ' + base + ', "wght" ' + Math.round(wght);
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
