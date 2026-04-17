/**
 * Niklas Weber — Portfolio
 * Technical Editorial · 2026
 */

(function() {
    'use strict';

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /**
     * Scroll progress indicator (hairline top bar)
     */
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
            const scrolled = (doc.scrollTop || document.body.scrollTop);
            const height = (doc.scrollHeight - doc.clientHeight);
            const pct = height > 0 ? Math.min(100, (scrolled / height) * 100) : 0;
            this.bar.style.transform = 'scaleX(' + (pct / 100) + ')';
            this.ticking = false;
        }
    }

    /**
     * Custom cursor · desktop only, inertia-smoothed ring
     */
    class Cursor {
        constructor() {
            this.cursor = document.querySelector('.cursor');
            if (!this.cursor) return;
            if (window.matchMedia('(pointer: coarse)').matches) return;
            if (prefersReducedMotion) return;

            this.target = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
            this.current = { x: this.target.x, y: this.target.y };
            this.ready = false;

            window.addEventListener('mousemove', (e) => {
                this.target.x = e.clientX;
                this.target.y = e.clientY;
                if (!this.ready) {
                    this.ready = true;
                    this.cursor.classList.add('cursor--ready');
                }
            }, { passive: true });

            const hoverTargets = document.querySelectorAll('a, button, summary, .project__figure, .contact__value, input, label');
            hoverTargets.forEach(el => {
                el.addEventListener('mouseenter', () => this.cursor.classList.add('cursor--hover'));
                el.addEventListener('mouseleave', () => this.cursor.classList.remove('cursor--hover'));
            });

            window.addEventListener('mousedown', () => this.cursor.classList.add('cursor--active'), { passive: true });
            window.addEventListener('mouseup', () => this.cursor.classList.remove('cursor--active'), { passive: true });

            this.loop();
        }

        loop() {
            this.current.x += (this.target.x - this.current.x) * 0.18;
            this.current.y += (this.target.y - this.current.y) * 0.18;
            this.cursor.style.transform = `translate3d(${this.current.x}px, ${this.current.y}px, 0)`;
            requestAnimationFrame(() => this.loop());
        }
    }

    /**
     * Nav section tracker — updates section number + active link
     */
    class NavigationIndex {
        constructor() {
            this.indexElement = document.querySelector('.nav__index-number');
            this.sections = document.querySelectorAll('.section');
            this.navLinks = document.querySelectorAll('.nav__link');

            if (!this.indexElement || this.sections.length === 0) return;

            this.observer = new IntersectionObserver(
                (entries) => this.handleIntersection(entries),
                { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
            );

            this.sections.forEach(section => this.observer.observe(section));
        }

        handleIntersection(entries) {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;

                const section = entry.target;
                const numberEl = section.querySelector('.section__number');
                if (numberEl) this.indexElement.textContent = numberEl.textContent;

                const sectionId = section.id;
                this.navLinks.forEach(link => {
                    const href = link.getAttribute('href');
                    link.classList.toggle('active', href === `#${sectionId}`);
                });
            });
        }
    }

    /**
     * Time display (Berlin)
     */
    class NavigationTime {
        constructor() {
            this.element = document.querySelector('.nav__time');
            if (!this.element) return;
            this.update();
            setInterval(() => this.update(), 30000);
        }

        update() {
            const now = new Date();
            const options = {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
                timeZone: 'Europe/Berlin'
            };
            this.element.textContent = now.toLocaleTimeString('de-DE', options);
        }
    }

    /**
     * Scroll reveal via data-reveal attribute
     */
    class ScrollReveal {
        constructor() {
            this.elements = document.querySelectorAll('[data-reveal], .about__lead-col, .about__secondary, .about__skills, .about__aside-full, .contact__layout');

            if (this.elements.length === 0) return;

            this.elements.forEach(el => {
                if (!el.hasAttribute('data-reveal')) el.setAttribute('data-reveal', '');
            });

            this.observer = new IntersectionObserver(
                (entries) => this.handleIntersection(entries),
                { rootMargin: '0px 0px -80px 0px', threshold: 0.08 }
            );

            this.elements.forEach(el => this.observer.observe(el));
        }

        handleIntersection(entries) {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    this.observer.unobserve(entry.target);
                }
            });
        }
    }

    /**
     * Skills staggered reveal
     */
    class SkillsReveal {
        constructor() {
            const skillsBlock = document.querySelector('.about__skills');
            if (!skillsBlock) return;

            const skills = skillsBlock.querySelectorAll('.about__skill');
            if (skills.length === 0) return;

            skills.forEach((skill, i) => {
                skill.style.transitionDelay = `${i * 0.08}s`;
            });

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        skillsBlock.classList.add('is-visible');
                        observer.disconnect();
                    }
                });
            }, { threshold: 0.15 });

            observer.observe(skillsBlock);
        }
    }

    /**
     * Smooth scroll for in-page anchors
     */
    class SmoothScroll {
        constructor() {
            this.links = document.querySelectorAll('a[href^="#"]');
            this.links.forEach(link => link.addEventListener('click', (e) => this.handleClick(e, link)));
        }

        handleClick(e, link) {
            const href = link.getAttribute('href');
            if (href === '#' || href.length < 2) return;

            const target = document.querySelector(href);
            if (!target) return;

            e.preventDefault();

            const headerOffset = 80;
            const elementPosition = target.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: prefersReducedMotion ? 'auto' : 'smooth'
            });

            history.pushState(null, '', href);
        }
    }

    /**
     * Mobile navigation overlay
     */
    class MobileNavigation {
        constructor() {
            this.nav = document.querySelector('.nav');
            this.toggle = document.querySelector('.nav__toggle');
            this.links = document.querySelectorAll('.nav__link');
            if (!this.nav || !this.toggle) return;

            this.isOpen = false;

            this.toggle.addEventListener('click', () => this.handleToggle());
            this.links.forEach(link => link.addEventListener('click', () => this.isOpen && this.close()));

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen) this.close();
            });

            window.matchMedia('(min-width: 901px)').addEventListener('change', (e) => {
                if (e.matches && this.isOpen) this.close();
            });
        }

        handleToggle() { this.isOpen ? this.close() : this.open(); }

        open() {
            this.isOpen = true;
            this.nav.classList.add('nav--open');
            this.toggle.setAttribute('aria-expanded', 'true');
            this.toggle.setAttribute('aria-label', 'Close menu');
            document.body.classList.add('nav-open');
        }

        close() {
            this.isOpen = false;
            this.nav.classList.remove('nav--open');
            this.toggle.setAttribute('aria-expanded', 'false');
            this.toggle.setAttribute('aria-label', 'Open menu');
            document.body.classList.remove('nav-open');
        }
    }

    /**
     * External link safety
     */
    class ExternalLinks {
        constructor() {
            document.querySelectorAll('a[target="_blank"]').forEach(link => {
                if (!link.hasAttribute('rel')) link.setAttribute('rel', 'noopener noreferrer');
            });
        }
    }

    /**
     * Init
     */
    function init() {
        new ScrollProgress();
        // Cursor removed per user preference
        new NavigationIndex();
        new NavigationTime();
        new ScrollReveal();
        new SkillsReveal();
        new SmoothScroll();
        new MobileNavigation();
        new ExternalLinks();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
