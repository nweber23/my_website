/**
 * Portfolio — Niklas Weber
 * Minimal, purposeful interactions
 */

(function() {
    'use strict';

    /**
     * Navigation index updater
     * Updates the current section index in the navigation
     */
    class NavigationIndex {
        constructor() {
            this.indexElement = document.querySelector('.nav__index-number');
            this.sections = document.querySelectorAll('.section');
            this.navLinks = document.querySelectorAll('.nav__link');

            if (!this.indexElement || this.sections.length === 0) return;

            this.init();
        }

        init() {
            this.observer = new IntersectionObserver(
                (entries) => this.handleIntersection(entries),
                {
                    rootMargin: '-40% 0px -60% 0px',
                    threshold: 0
                }
            );

            this.sections.forEach(section => this.observer.observe(section));
        }

        handleIntersection(entries) {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const section = entry.target;
                    const index = section.querySelector('.section__number');

                    if (index) {
                        this.indexElement.textContent = index.textContent;
                    }

                    // Update active nav link
                    const sectionId = section.id;
                    this.navLinks.forEach(link => {
                        const href = link.getAttribute('href');
                        if (href === `#${sectionId}`) {
                            link.classList.add('active');
                        } else {
                            link.classList.remove('active');
                        }
                    });
                }
            });
        }
    }

    /**
     * Navigation time display
     * Shows current time in Berlin timezone
     */
    class NavigationTime {
        constructor() {
            this.element = document.querySelector('.nav__time');
            if (!this.element) return;

            this.update();
            // Update every minute, not every second - less resource intensive
            setInterval(() => this.update(), 60000);
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
     * Scroll reveal
     * Simple reveal animation for elements as they enter viewport
     */
    class ScrollReveal {
        constructor() {
            this.elements = document.querySelectorAll(
                '.project, .about__primary, .about__secondary, .about__skills, .about__aside-full, .contact__layout'
            );

            if (this.elements.length === 0) return;

            this.init();
        }

        init() {
            // Add reveal class to elements
            this.elements.forEach(el => el.classList.add('reveal'));

            this.observer = new IntersectionObserver(
                (entries) => this.handleIntersection(entries),
                {
                    rootMargin: '0px 0px -80px 0px',
                    threshold: 0.1
                }
            );

            this.elements.forEach(el => this.observer.observe(el));
        }

        handleIntersection(entries) {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    this.observer.unobserve(entry.target);
                }
            });
        }
    }

    /**
     * Smooth scroll for anchor links
     */
    class SmoothScroll {
        constructor() {
            this.links = document.querySelectorAll('a[href^="#"]');
            if (this.links.length === 0) return;

            this.init();
        }

        init() {
            this.links.forEach(link => {
                link.addEventListener('click', (e) => this.handleClick(e, link));
            });
        }

        handleClick(e, link) {
            const href = link.getAttribute('href');
            if (href === '#') return;

            const target = document.querySelector(href);
            if (!target) return;

            e.preventDefault();

            const headerOffset = 100;
            const elementPosition = target.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });

            // Update URL without scrolling
            history.pushState(null, null, href);
        }
    }

    /**
     * Project image interaction
     * Subtle scale on hover for project images
     */
    class ProjectImageHover {
        constructor() {
            this.figures = document.querySelectorAll('.project__figure');
            if (this.figures.length === 0) return;

            this.init();
        }

        init() {
            this.figures.forEach(figure => {
                const image = figure.querySelector('.project__image');
                if (!image) return;

                figure.addEventListener('mouseenter', () => {
                    image.style.transform = 'scale(1.02)';
                });

                figure.addEventListener('mouseleave', () => {
                    image.style.transform = 'scale(1)';
                });
            });
        }
    }

    /**
     * Staggered reveal for skills
     * Adds slight delay to each skill item
     */
    class SkillsReveal {
        constructor() {
            this.skillsList = document.querySelector('.about__skills-list');
            if (!this.skillsList) return;

            this.skills = this.skillsList.querySelectorAll('.about__skill');
            if (this.skills.length === 0) return;

            this.init();
        }

        init() {
            this.skills.forEach((skill, index) => {
                skill.style.transitionDelay = `${index * 0.1}s`;
            });
        }
    }

    /**
     * Reduce motion preference
     * Respects user's motion preferences
     */
    class ReducedMotion {
        constructor() {
            this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

            if (this.prefersReducedMotion.matches) {
                this.disableAnimations();
            }

            this.prefersReducedMotion.addEventListener('change', () => {
                if (this.prefersReducedMotion.matches) {
                    this.disableAnimations();
                } else {
                    this.enableAnimations();
                }
            });
        }

        disableAnimations() {
            document.documentElement.style.setProperty('--animation-duration', '0s');

            // Remove reveal animations
            document.querySelectorAll('.reveal').forEach(el => {
                el.classList.add('visible');
                el.style.transition = 'none';
            });
        }

        enableAnimations() {
            document.documentElement.style.removeProperty('--animation-duration');
        }
    }

    /**
     * External link handler
     * Adds rel attributes to external links for security
     */
    class ExternalLinks {
        constructor() {
            const externalLinks = document.querySelectorAll('a[target="_blank"]');

            externalLinks.forEach(link => {
                if (!link.hasAttribute('rel')) {
                    link.setAttribute('rel', 'noopener noreferrer');
                }
            });
        }
    }

    /**
     * Initialize all modules when DOM is ready
     */
    function init() {
        new NavigationIndex();
        new NavigationTime();
        new ScrollReveal();
        new SmoothScroll();
        new ProjectImageHover();
        new SkillsReveal();
        new ReducedMotion();
        new ExternalLinks();
    }

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
