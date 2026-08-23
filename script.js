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

    /* ===== Live GitHub activity ===== */
    class GitHubActivity {
        constructor() {
            this.root = document.querySelector('[data-github-stats]');
            if (!this.root) return;
            this.els = {
                repos: this.root.querySelector('[data-gh-repos]'),
                stars: this.root.querySelector('[data-gh-stars]'),
                followers: this.root.querySelector('[data-gh-followers]'),
                commits: this.root.querySelector('[data-gh-commits]'),
                graph: this.root.querySelector('[data-gh-graph]')
            };
            this.load();
        }
        async load() {
            const cacheKey = 'gh-stats-v2';
            const cacheTTL = 1000 * 60 * 60 * 6;
            try {
                const cached = JSON.parse(localStorage.getItem(cacheKey));
                if (cached && Date.now() - cached.ts < cacheTTL) {
                    this.render(cached.data);
                    return;
                }
            } catch (e) { /* corrupt or unavailable cache, fall through to fetch */ }

            try {
                const [userRes, reposRes, contribRes] = await Promise.all([
                    fetch('https://api.github.com/users/nweber23'),
                    fetch('https://api.github.com/users/nweber23/repos?per_page=100'),
                    fetch('https://github-contributions-api.jogruber.de/v4/nweber23?y=last')
                ]);
                if (!userRes.ok || !reposRes.ok) throw new Error('github api error');
                const user = await userRes.json();
                const repos = await reposRes.json();
                const stars = Array.isArray(repos)
                    ? repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0)
                    : null;

                let commits = null, days = null;
                if (contribRes.ok) {
                    const contrib = await contribRes.json();
                    commits = contrib.total && contrib.total.lastYear;
                    days = contrib.contributions;
                }

                const data = { repos: user.public_repos, followers: user.followers, stars, commits, days };
                try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data })); } catch (e) { /* storage unavailable */ }
                this.render(data);
            } catch (e) {
                /* API unreachable or rate-limited — leave the static fallback numbers in the markup */
            }
        }
        render(data) {
            if (this.els.repos && data.repos != null) this.els.repos.textContent = data.repos;
            if (this.els.stars && data.stars != null) this.els.stars.textContent = data.stars;
            if (this.els.followers && data.followers != null) this.els.followers.textContent = data.followers;
            if (this.els.commits && data.commits != null) this.els.commits.textContent = data.commits;
            if (this.els.graph && Array.isArray(data.days) && data.days.length) this.renderGraph(data.days);
            this.root.classList.add('is-live');
        }
        renderGraph(days) {
            const svgNS = 'http://www.w3.org/2000/svg';
            const cell = 11, gap = 3;
            const first = new Date(days[0].date + 'T00:00:00');
            const startPad = first.getDay();
            const cols = Math.ceil((startPad + days.length) / 7);
            const width = cols * (cell + gap) - gap;
            const height = 7 * (cell + gap) - gap;
            const levelColors = ['var(--border-2)', '#5C2413', '#A8391B', '#E0491F', 'var(--accent)'];

            const svg = document.createElementNS(svgNS, 'svg');
            svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
            svg.setAttribute('width', width);
            svg.setAttribute('height', height);

            days.forEach((d, i) => {
                const idx = startPad + i;
                const col = Math.floor(idx / 7);
                const row = idx % 7;
                const rect = document.createElementNS(svgNS, 'rect');
                rect.setAttribute('x', col * (cell + gap));
                rect.setAttribute('y', row * (cell + gap));
                rect.setAttribute('width', cell);
                rect.setAttribute('height', cell);
                rect.setAttribute('rx', 2);
                rect.setAttribute('fill', levelColors[d.level] || levelColors[0]);

                const dateLabel = new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric'
                });
                rect.dataset.count = d.count;
                rect.dataset.date = dateLabel;

                const title = document.createElementNS(svgNS, 'title');
                title.textContent = d.count + (d.count === 1 ? ' contribution on ' : ' contributions on ') + dateLabel;
                rect.appendChild(title);
                svg.appendChild(rect);
            });

            this.els.graph.innerHTML = '';
            this.els.graph.appendChild(svg);
            this.attachTooltip(svg);
        }
        attachTooltip(svg) {
            if (!this.tooltip) {
                this.tooltip = document.createElement('div');
                this.tooltip.className = 'gh-stats__tooltip';
                this.tooltipCount = document.createElement('strong');
                this.tooltipRest = document.createTextNode('');
                this.tooltip.appendChild(this.tooltipCount);
                this.tooltip.appendChild(this.tooltipRest);
                document.body.appendChild(this.tooltip);
            }
            const tooltip = this.tooltip;
            const margin = 8;

            const show = (rect, evt) => {
                const count = rect.dataset.count;
                this.tooltipCount.textContent = count;
                this.tooltipRest.textContent = ' ' + (count === '1' ? 'contribution' : 'contributions') + ' on ' + rect.dataset.date;

                const tw = tooltip.offsetWidth;
                const th = tooltip.offsetHeight;
                let left = evt.clientX - tw / 2;
                left = Math.max(margin, Math.min(left, window.innerWidth - tw - margin));
                let top = evt.clientY - th - 14;
                if (top < margin) top = evt.clientY + 18;

                tooltip.style.left = left + 'px';
                tooltip.style.top = top + 'px';
                tooltip.classList.add('is-visible');
            };
            const hide = () => tooltip.classList.remove('is-visible');

            svg.addEventListener('pointerover', e => {
                if (e.target.tagName === 'rect') show(e.target, e);
            });
            svg.addEventListener('pointermove', e => {
                if (e.target.tagName === 'rect') show(e.target, e);
            });
            svg.addEventListener('pointerout', e => {
                if (e.target.tagName === 'rect') hide();
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

    /* ===== Word-scrub reveal — paragraph settles in word-by-word on scroll ===== */
    class WordScrub {
        constructor() {
            if (prefersReducedMotion) return;
            this.els = document.querySelectorAll('[data-word-scrub]');
            if (!this.els.length) return;

            this.els.forEach(el => {
                const text = el.textContent.trim();
                el.textContent = '';
                text.split(/(\s+)/).forEach(chunk => {
                    if (!chunk.trim()) { el.appendChild(document.createTextNode(chunk)); return; }
                    const span = document.createElement('span');
                    span.className = 'word';
                    span.textContent = chunk;
                    span.style.setProperty('--i', el.querySelectorAll('.word').length);
                    el.appendChild(span);
                });
            });

            const observer = new IntersectionObserver(entries => {
                entries.forEach(e => {
                    if (!e.isIntersecting) return;
                    e.target.classList.add('is-visible');
                    observer.unobserve(e.target);
                });
            }, { rootMargin: '0px 0px -100px 0px', threshold: 0.2 });
            this.els.forEach(el => observer.observe(el));
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

    /* ===== Number heat — ghost project numbers warm near the cursor =====
       The stroked 01/02/03 outlines heat from border-gray to ember as
       the pointer approaches, with a faint glow at full heat. Heating
       is fast, cooling is slow — like metal. */
    class NumberHeat {
        constructor() {
            if (prefersReducedMotion || !finePointer) return;
            if (window.matchMedia('(max-width: 900px)').matches) return;
            this.els = Array.from(document.querySelectorAll('.project__num'));
            if (!this.els.length) return;

            this.COLD = [41, 36, 28];      // --border
            this.HOT = [255, 77, 28];      // --accent
            this.RADIUS = 320;
            this.heats = this.els.map(() => 0);
            this.targets = this.els.map(() => 0);
            this.running = false;

            document.addEventListener('pointermove', e => this.onMove(e), { passive: true });
            document.addEventListener('pointerleave', () => {
                this.targets.fill(0);
                this.start();
            });
        }

        onMove(e) {
            const R = this.RADIUS;
            let wake = false;
            for (let i = 0; i < this.els.length; i++) {
                const r = this.els[i].getBoundingClientRect();
                if (r.bottom < -R || r.top > window.innerHeight + R) {
                    this.targets[i] = 0;
                    continue;
                }
                // distance from pointer to the nearest edge of the glyph box
                const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right);
                const dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
                const t = Math.max(0, 1 - Math.hypot(dx, dy) / R);
                this.targets[i] = t * t;
                if (t > 0) wake = true;
            }
            if (wake || this.heats.some(h => h > 0.004)) this.start();
        }

        start() {
            if (this.running) return;
            this.running = true;
            const tick = () => {
                let settled = true;
                for (let i = 0; i < this.els.length; i++) {
                    const target = this.targets[i];
                    let h = this.heats[i];
                    h += (target - h) * (target > h ? 0.3 : 0.05);
                    if (Math.abs(target - h) > 0.003) settled = false;
                    else h = target;
                    this.heats[i] = h;
                    this.paint(i, h);
                }
                if (settled) { this.running = false; return; }
                requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        }

        paint(i, h) {
            const el = this.els[i];
            if (h < 0.004) {
                el.style.webkitTextStrokeColor = '';
                el.style.textShadow = '';
                return;
            }
            const c = this.COLD, k = this.HOT;
            el.style.webkitTextStrokeColor = 'rgb(' +
                Math.round(c[0] + (k[0] - c[0]) * h) + ',' +
                Math.round(c[1] + (k[1] - c[1]) * h) + ',' +
                Math.round(c[2] + (k[2] - c[2]) * h) + ')';
            el.style.textShadow =
                '0 0 ' + Math.round(28 * h) + 'px rgba(255,77,28,' + (0.35 * h).toFixed(3) + ')';
        }
    }

    /* ===== Endmark forge — the closing name as molten particles =====
       The giant stroked "NIKLAS WEBER" is rebuilt from ~3k canvas
       particles sampled off its outline. The cursor acts like an
       angle grinder: nearby particles ignite and spray off with the
       pointer's momentum, then spring back into the outline. Falls
       back to the static stroked span on touch, small screens and
       reduced motion. */
    class EndmarkForge {
        constructor() {
            if (prefersReducedMotion || !finePointer) return;
            if (window.matchMedia('(max-width: 900px)').matches) return;
            this.root = document.querySelector('.endmark');
            this.span = this.root ? this.root.querySelector('span') : null;
            if (!this.span) return;

            this.particles = [];
            this.colors = this.buildRamp();
            this.px = -1e4; this.py = -1e4;   // pointer in canvas space
            this.pvx = 0; this.pvy = 0;       // pointer velocity → spray direction
            this.lastMove = 0;
            this.inside = false;
            this.running = false;
            this.built = false;
            this.visible = false;
            this.calm = true;

            this.canvas = document.createElement('canvas');
            this.canvas.className = 'endmark__canvas';
            this.ctx = this.canvas.getContext('2d');
            this.root.appendChild(this.canvas);

            const io = new IntersectionObserver(entries => {
                entries.forEach(e => {
                    this.visible = e.isIntersecting;
                    if (e.isIntersecting) this.activate();
                });
            }, { rootMargin: '160px' });
            io.observe(this.root);

            this.root.addEventListener('pointermove', e => this.onMove(e), { passive: true });
            this.root.addEventListener('pointerleave', () => { this.inside = false; }, { passive: true });
            this.root.addEventListener('pointerdown', e => this.blast(e), { passive: true });

            let timer;
            window.addEventListener('resize', () => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                    this.built = false;
                    if (this.visible) this.activate();
                }, 160);
            }, { passive: true });
        }

        /* 16-step color ramp: cold stroke → ember → white-hot */
        buildRamp() {
            const stops = [
                [0.00, 66, 58, 46],
                [0.30, 128, 62, 30],
                [0.55, 255, 77, 28],     // --accent
                [0.80, 255, 146, 72],
                [1.00, 255, 228, 184]
            ];
            const ramp = [];
            for (let i = 0; i < 16; i++) {
                const t = i / 15;
                let a = stops[0], b = stops[stops.length - 1];
                for (let s = 0; s < stops.length - 1; s++) {
                    if (t >= stops[s][0] && t <= stops[s + 1][0]) { a = stops[s]; b = stops[s + 1]; break; }
                }
                const f = (t - a[0]) / ((b[0] - a[0]) || 1);
                ramp.push('rgb(' +
                    Math.round(a[1] + (b[1] - a[1]) * f) + ',' +
                    Math.round(a[2] + (b[2] - a[2]) * f) + ',' +
                    Math.round(a[3] + (b[3] - a[3]) * f) + ')');
            }
            return ramp;
        }

        activate() {
            if (this.built) { this.start(); return; }
            if (this.waitingFonts) return;
            this.waitingFonts = true;
            document.fonts.ready.then(() => {
                this.waitingFonts = false;
                if (!this.visible || this.built) return;
                if (this.build()) this.start();
            });
        }

        /* Stamp the stroked name once, lift its pixels into particles */
        build() {
            const w = this.root.clientWidth;
            const h = this.root.clientHeight;
            if (!w || !h) return false;
            this.w = w; this.h = h;
            this.dpr = Math.min(2, window.devicePixelRatio || 1);
            this.canvas.width = Math.round(w * this.dpr);
            this.canvas.height = Math.round(h * this.dpr);

            const ctx = this.ctx;
            const fs = parseFloat(getComputedStyle(this.span).fontSize);
            this.radius = fs * 0.85;
            const cy = this.span.offsetTop + this.span.offsetHeight / 2;
            const text = (this.span.textContent || '').trim().toUpperCase();

            this.canvas.style.fontVariationSettings = '"wdth" 110, "wght" 800';
            ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            ctx.clearRect(0, 0, w, h);
            ctx.font = '800 ' + fs + 'px Archivo, sans-serif';
            if ('letterSpacing' in ctx) ctx.letterSpacing = (fs * -0.01).toFixed(2) + 'px';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineWidth = Math.max(1.5, fs / 64);
            ctx.strokeStyle = '#fff';
            ctx.strokeText(text, w / 2, cy + fs * 0.04);

            const dw = this.canvas.width, dh = this.canvas.height;
            const img = ctx.getImageData(0, 0, dw, dh).data;
            ctx.clearRect(0, 0, w, h);

            const pts = [];
            const step = Math.max(2, Math.round(this.dpr * 1.6));
            for (let y = 0; y < dh; y += step) {
                for (let x = 0; x < dw; x += step) {
                    if (img[(y * dw + x) * 4 + 3] > 100) pts.push(x / this.dpr, y / this.dpr);
                }
            }
            const total = pts.length / 2;
            if (!total) return false;
            const stride = Math.max(1, Math.ceil(total / 3600));
            this.particles = [];
            for (let i = 0; i < total; i += stride) {
                const hx = pts[i * 2], hy = pts[i * 2 + 1];
                this.particles.push({
                    x: hx, y: hy, hx, hy, vx: 0, vy: 0,
                    heat: 0, b: 0, sz: 1.1 + Math.random() * 0.7
                });
            }
            this.built = true;
            this.root.classList.add('endmark--forge');
            this.renderFrame();
            return true;
        }

        onMove(e) {
            if (!this.built) return;
            const r = this.canvas.getBoundingClientRect();
            const x = e.clientX - r.left;
            const y = e.clientY - r.top;
            const now = performance.now();
            const dt = now - this.lastMove;
            if (this.lastMove && dt > 0 && dt < 120) {
                const k = 16 / dt;   // normalize to px-per-frame
                this.pvx = Math.max(-28, Math.min(28, (x - this.px) * k));
                this.pvy = Math.max(-28, Math.min(28, (y - this.py) * k));
            }
            this.lastMove = now;
            this.px = x; this.py = y;
            this.inside = true;
            this.start();
        }

        /* Click → shockwave: a wider, harder detonation */
        blast(e) {
            if (!this.built) return;
            const r = this.canvas.getBoundingClientRect();
            const bx = e.clientX - r.left, by = e.clientY - r.top;
            const R = this.radius * 2.2, R2 = R * R;
            for (const p of this.particles) {
                const dx = p.x - bx, dy = p.y - by;
                const d2 = dx * dx + dy * dy;
                if (d2 >= R2) continue;
                const d = Math.sqrt(d2) || 1;
                const f = 1 - d / R;
                p.vx += (dx / d) * f * 16 + (Math.random() - 0.5) * f * 5;
                p.vy += (dy / d) * f * 16 + (Math.random() - 0.5) * f * 5 - f * 2;
                p.heat = Math.min(1, p.heat + f * 1.4);
            }
            this.start();
        }

        start() {
            if (this.running || !this.built) return;
            this.running = true;
            const loop = () => {
                if (!this.visible) { this.running = false; return; }
                this.stepPhysics();
                this.renderFrame();
                if (!this.inside && this.calm) { this.running = false; return; }
                requestAnimationFrame(loop);
            };
            requestAnimationFrame(loop);
        }

        stepPhysics() {
            const R = this.radius, R2 = R * R;
            const px = this.px, py = this.py;
            const active = this.inside;
            const P = this.particles;
            let calm = !active;
            for (let i = 0; i < P.length; i++) {
                const p = P[i];
                if (active) {
                    const dx = p.x - px, dy = p.y - py;
                    const d2 = dx * dx + dy * dy;
                    if (d2 < R2) {
                        const d = Math.sqrt(d2) || 1;
                        const f = 1 - d / R;
                        const f2 = f * f;
                        p.vx += (dx / d) * f2 * 3.2 + this.pvx * f2 * 0.5 + (Math.random() - 0.5) * f2 * 2.4;
                        p.vy += (dy / d) * f2 * 3.2 + this.pvy * f2 * 0.5 + (Math.random() - 0.5) * f2 * 2.4 - f2 * 0.9;
                        p.heat = Math.min(1, p.heat + f2 * 1.2);
                    }
                }
                p.vx += (p.hx - p.x) * 0.013;
                p.vy += (p.hy - p.y) * 0.013;
                p.vx *= 0.91; p.vy *= 0.91;
                p.x += p.vx; p.y += p.vy;
                p.heat = p.heat > 0.006 ? p.heat * 0.96 : 0;
                p.b = (p.heat * 15) | 0;
                if (calm && (p.heat > 0 ||
                    Math.abs(p.x - p.hx) + Math.abs(p.y - p.hy) > 0.4 ||
                    Math.abs(p.vx) + Math.abs(p.vy) > 0.06)) calm = false;
            }
            this.pvx *= 0.8; this.pvy *= 0.8;
            this.calm = calm;
            if (calm) {
                for (let i = 0; i < P.length; i++) {
                    const p = P[i];
                    p.x = p.hx; p.y = p.hy; p.vx = 0; p.vy = 0; p.heat = 0; p.b = 0;
                }
            }
        }

        renderFrame() {
            const ctx = this.ctx;
            ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            ctx.clearRect(0, 0, this.w, this.h);
            const P = this.particles, ramp = this.colors;
            for (let b = 0; b < ramp.length; b++) {
                let set = false;
                for (let i = 0; i < P.length; i++) {
                    const p = P[i];
                    if (p.b !== b) continue;
                    if (!set) { ctx.fillStyle = ramp[b]; ctx.strokeStyle = ramp[b]; set = true; }
                    const speed = Math.abs(p.vx) + Math.abs(p.vy);
                    if (speed > 3.5) {
                        // fast sparks render as motion streaks
                        ctx.lineWidth = Math.min(2, p.sz);
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p.x - p.vx * 1.6, p.y - p.vy * 1.6);
                        ctx.stroke();
                    } else {
                        const s = p.sz + p.heat * 1.2;
                        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
                    }
                }
            }
        }
    }

    /* ===== Init ===== */
    function init() {
        new ScrollProgress();
        new NavTracker();
        new NavTime();
        new ScrollReveal();
        new SkillsReveal();
        new WordScrub();
        new Decode();
        new Scrub();
        new Crosshair();
        new SmoothScroll();
        new MobileNav();
        new ExternalLinks();
        new HeroInteractive();
        new MetricCountUp();
        new NumberHeat();
        new EndmarkForge();
        new GitHubActivity();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
