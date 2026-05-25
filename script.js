/**
 * Niklas Weber — Portfolio
 * Dark Editorial · 2026
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

    /* ===== GSAP animations ===== */
    class GSAPAnimations {
        constructor() {
            if (prefersReducedMotion) return;
            if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

            gsap.registerPlugin(ScrollTrigger);
            this.animateImages();
            this.animateSectionTitles();
        }

        animateImages() {
            document.querySelectorAll('.project__img-wrap').forEach(wrap => {
                const img = wrap.querySelector('.project__img');
                if (!img) return;

                gsap.fromTo(img,
                    { scale: 0.92, filter: 'grayscale(25%) contrast(1.0) brightness(0.85)' },
                    {
                        scale: 1.0,
                        filter: 'grayscale(15%) contrast(1.05) brightness(0.92)',
                        ease: 'power2.out',
                        scrollTrigger: {
                            trigger: wrap,
                            start: 'top 90%',
                            end: 'top 20%',
                            scrub: 1.2
                        }
                    }
                );
            });
        }

        animateSectionTitles() {
            document.querySelectorAll('.section__title').forEach(title => {
                gsap.fromTo(title,
                    { opacity: 0, y: 24 },
                    {
                        opacity: 1, y: 0,
                        duration: 0.7,
                        ease: 'power3.out',
                        scrollTrigger: {
                            trigger: title,
                            start: 'top 85%',
                            toggleActions: 'play none none none'
                        }
                    }
                );
            });
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
        new GSAPAnimations();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
