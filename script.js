// Grain Canvas Effect
class GrainEffect {
    constructor() {
        this.canvas = document.getElementById('grain-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        this.loop();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    noise() {
        const imageData = this.ctx.createImageData(this.canvas.width, this.canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const value = Math.random() * 255;
            data[i] = value;
            data[i + 1] = value;
            data[i + 2] = value;
            data[i + 3] = 255;
        }

        this.ctx.putImageData(imageData, 0, 0);
    }

    loop() {
        this.noise();
        requestAnimationFrame(() => this.loop());
    }
}

// Custom Cursor
class CustomCursor {
    constructor() {
        this.cursor = document.querySelector('.cursor');
        this.follower = document.querySelector('.cursor-follower');
        this.pos = { x: 0, y: 0 };
        this.mouse = { x: 0, y: 0 };
        this.speed = 0.15;

        if (!this.cursor || !this.follower) return;

        this.init();
    }

    init() {
        document.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;

            this.cursor.style.left = `${e.clientX}px`;
            this.cursor.style.top = `${e.clientY}px`;
        });

        this.render();
        this.addHoverEffects();
    }

    render() {
        this.pos.x += (this.mouse.x - this.pos.x) * this.speed;
        this.pos.y += (this.mouse.y - this.pos.y) * this.speed;

        this.follower.style.left = `${this.pos.x}px`;
        this.follower.style.top = `${this.pos.y}px`;

        requestAnimationFrame(() => this.render());
    }

    addHoverEffects() {
        const hoverElements = document.querySelectorAll('a, button, .magnetic');

        hoverElements.forEach(el => {
            el.addEventListener('mouseenter', () => {
                this.follower.classList.add('hovering');
                this.cursor.style.transform = 'scale(2)';
            });

            el.addEventListener('mouseleave', () => {
                this.follower.classList.remove('hovering');
                this.cursor.style.transform = 'scale(1)';
            });
        });
    }
}

// Magnetic Effect
class MagneticEffect {
    constructor() {
        this.elements = document.querySelectorAll('.magnetic');
        this.init();
    }

    init() {
        this.elements.forEach(el => {
            el.addEventListener('mousemove', (e) => this.move(e, el));
            el.addEventListener('mouseleave', (e) => this.leave(e, el));
        });
    }

    move(e, el) {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;

        el.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
    }

    leave(e, el) {
        el.style.transform = 'translate(0, 0)';
    }
}

// Navigation Time
class NavTime {
    constructor() {
        this.element = document.querySelector('.nav-time');
        if (!this.element) return;
        this.update();
        setInterval(() => this.update(), 1000);
    }

    update() {
        const now = new Date();
        const options = {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'Europe/Berlin'
        };
        this.element.textContent = `${now.toLocaleTimeString('de-DE', options)} Berlin`;
    }
}

// Scroll Reveal Animation
class ScrollReveal {
    constructor() {
        this.elements = document.querySelectorAll('.project, .timeline-item, .about-intro, .about-body, .about-philosophy, .contact-item');
        this.init();
    }

    init() {
        this.elements.forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(50px)';
            el.style.transition = 'opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1), transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)';
        });

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        this.elements.forEach(el => observer.observe(el));
    }
}

// Parallax Shapes
class ParallaxShapes {
    constructor() {
        this.shapes = document.querySelectorAll('.shape');
        if (this.shapes.length === 0) return;

        window.addEventListener('mousemove', (e) => this.move(e));
    }

    move(e) {
        const x = (e.clientX / window.innerWidth - 0.5) * 2;
        const y = (e.clientY / window.innerHeight - 0.5) * 2;

        this.shapes.forEach((shape, i) => {
            const speed = (i + 1) * 20;
            shape.style.transform = `translate(${x * speed}px, ${y * speed}px)`;
        });
    }
}

// Text Scramble Effect for Project Titles
class TextScramble {
    constructor() {
        this.chars = '!<>-_\\/[]{}—=+*^?#________';
        this.projectTitles = document.querySelectorAll('.project-title-main');
        this.init();
    }

    init() {
        this.projectTitles.forEach(el => {
            const originalText = el.textContent;

            el.addEventListener('mouseenter', () => {
                this.scramble(el, originalText);
            });
        });
    }

    scramble(el, finalText) {
        let iteration = 0;
        const interval = setInterval(() => {
            el.textContent = finalText
                .split('')
                .map((char, i) => {
                    if (i < iteration) return finalText[i];
                    return this.chars[Math.floor(Math.random() * this.chars.length)];
                })
                .join('');

            if (iteration >= finalText.length) {
                clearInterval(interval);
            }

            iteration += 1/3;
        }, 30);
    }
}

// Smooth Scroll
class SmoothScroll {
    constructor() {
        this.links = document.querySelectorAll('a[href^="#"]');
        this.init();
    }

    init() {
        this.links.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href');
                const target = document.querySelector(targetId);

                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }
}

// Orbit Pause on Hover
class OrbitPause {
    constructor() {
        const orbits = document.querySelectorAll('.orbit-ring');
        const skillNodes = document.querySelectorAll('.skill-node');

        skillNodes.forEach(node => {
            node.addEventListener('mouseenter', () => {
                orbits.forEach(orbit => {
                    orbit.style.animationPlayState = 'paused';
                });
            });

            node.addEventListener('mouseleave', () => {
                orbits.forEach(orbit => {
                    orbit.style.animationPlayState = 'running';
                });
            });
        });
    }
}

// Section Progress Indicator
class SectionProgress {
    constructor() {
        this.sections = document.querySelectorAll('section');
        this.sectionNumbers = document.querySelectorAll('.section-number');

        window.addEventListener('scroll', () => this.update());
    }

    update() {
        const scrollPosition = window.scrollY + window.innerHeight / 2;

        this.sections.forEach((section, i) => {
            const sectionTop = section.offsetTop;
            const sectionBottom = sectionTop + section.offsetHeight;

            if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
                document.body.setAttribute('data-section', section.id || 'hero');
            }
        });
    }
}

// Initialize Everything
document.addEventListener('DOMContentLoaded', () => {
    new GrainEffect();
    new CustomCursor();
    new MagneticEffect();
    new NavTime();
    new ScrollReveal();
    new ParallaxShapes();
    new TextScramble();
    new SmoothScroll();
    new OrbitPause();
    new SectionProgress();

    // Add loaded class after a small delay for entrance animations
    setTimeout(() => {
        document.body.classList.add('loaded');
    }, 100);
});

// Page Visibility API - Pause animations when tab is not visible
document.addEventListener('visibilitychange', () => {
    const canvas = document.getElementById('grain-canvas');
    if (document.hidden) {
        canvas.style.display = 'none';
    } else {
        canvas.style.display = 'block';
    }
});
