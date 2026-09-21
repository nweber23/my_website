/**
 * Niklas Weber — Portfolio
 * Descent · 2026
 */

(function () {
    'use strict';

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

    /* ===== Hero stack — a physical model you can handle =====
       The five slabs fall in under gravity and land with a bounce,
       a shockwave through the ones below, and a ring across their
       face. You can drag the whole assembly round and it keeps its
       momentum; left alone it drifts back home. Pointing at a layer
       pulls it out of the stack on a spring and names the project
       that lives there; clicking it dives into that layer. A small
       loop integrates everything and writes CSS variables, and it
       only runs while the hero is on screen. */
    class HeroStack {
        constructor() {
            this.stack = document.querySelector('[data-stack]');
            this.hero = document.querySelector('.hero');
            if (!this.stack || !this.hero) return;
            this.scene = this.stack.querySelector('.stack__scene');
            this.card = this.stack.querySelector('[data-stack-card]');
            this.cardEls = this.card && {
                kicker: this.card.querySelector('[data-card-kicker]'),
                title: this.card.querySelector('[data-card-title]'),
                text: this.card.querySelector('[data-card-text]'),
                go: this.card.querySelector('[data-card-go]')
            };
            this.plates = Array.from(this.stack.querySelectorAll('[data-goto]')).map(el => ({
                el, i: parseInt(el.style.getPropertyValue('--i'), 10) || 0,
                z: 0, vz: 0, x: 0, vx: 0, zT: 0, xT: 0, phase: 'spring', delay: 0
            })).sort((a, b) => a.i - b.i);

            this.reduced = prefersReducedMotion;
            this.touch = !finePointer;
            this.HOME_RZ = -36; this.HOME_RX = 55;
            this.yaw = 0; this.yawV = 0; this.pitch = 0;
            this.tilt = { x: 0, y: 0 }; this.tiltT = { x: 0, y: 0 };
            this.shake = 0; this.shakeV = 0;
            this.dive = 0; this.diveV = 0; this.diveT = 0;
            this.spread = 1; this.spreadT = 1;
            this.hover = -1; this.hoverPos = { x: 0, y: 0 };
            this.dragging = false; this.pd = null;
            this.lastInput = 0;
            this.visible = true; this.running = false;

            this.measure();
            window.addEventListener('resize', () => this.measure(), { passive: true });
            window.addEventListener('scroll', () => this.onScroll(), { passive: true });
            this.bindInput();
            this.onScroll();
            this.paintCard();

            new IntersectionObserver(entries => {
                this.visible = entries[0].isIntersecting;
                if (this.visible) this.start();
            }).observe(this.hero);

            this.intro();
        }

        measure() {
            this.s = this.scene.offsetWidth || 300;
            this.gap = this.s * 0.18;
        }

        /* the slabs fall in bottom-first, staggered */
        intro() {
            if (!this.reduced) {
                this.plates.forEach(p => {
                    p.z = this.s * (1.3 + p.i * 0.35);
                    p.vz = 0;
                    p.phase = 'wait';
                    p.delay = 0.1 + p.i * 0.14;
                    p.el.classList.add('is-waiting');
                });
            }
            this.render();
            this.stack.classList.add('is-ready');
            this.start();
        }

        bindInput() {
            const st = this.stack;
            const plateAt = e => {
                const el = e.target.closest && e.target.closest('[data-goto]');
                return el ? this.plates.find(p => p.el === el) : null;
            };
            const now = () => performance.now() / 1000;

            st.addEventListener('pointerdown', e => {
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                this.pd = { id: e.pointerId, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY,
                            lt: e.timeStamp, moved: false, plate: plateAt(e), type: e.pointerType };
            });

            window.addEventListener('pointermove', e => {
                if (finePointer && !this.reduced) {
                    this.tiltT.x = (e.clientX / window.innerWidth) * 2 - 1;
                    this.tiltT.y = (e.clientY / window.innerHeight) * 2 - 1;
                }
                const pd = this.pd;
                if (pd && e.pointerId === pd.id) {
                    const dx = e.clientX - pd.lx, dy = e.clientY - pd.ly;
                    const dt = Math.max(1, e.timeStamp - pd.lt) / 1000;
                    if (!pd.moved && Math.hypot(e.clientX - pd.sx, e.clientY - pd.sy) > 6) {
                        pd.moved = true;
                        this.dragging = true;
                        st.classList.add('is-dragging');
                        try { st.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
                        this.setHover(-1);
                    }
                    if (this.dragging && !this.reduced) {
                        this.yaw += dx * 0.45;
                        this.pitch = clamp(this.pitch - dy * 0.25, -25, 22);
                        this.yawV = this.yawV * 0.5 + (dx * 0.45 / dt) * 0.5;
                        this.lastInput = now();
                    }
                    pd.lx = e.clientX; pd.ly = e.clientY; pd.lt = e.timeStamp;
                    this.poke();
                    return;
                }
                if (e.pointerType === 'mouse' && !this.dragging && st.contains(e.target)) this.hoverAt(e, plateAt(e));
            }, { passive: true });

            st.addEventListener('pointerleave', e => {
                if (e.pointerType === 'mouse' && !this.dragging) this.setHover(-1);
            });

            const end = e => {
                const pd = this.pd;
                if (!pd || e.pointerId !== pd.id) return;
                this.pd = null;
                try { st.releasePointerCapture(e.pointerId); } catch (err) { /* not captured */ }
                if (pd.moved) {
                    this.dragging = false;
                    st.classList.remove('is-dragging');
                    this.lastInput = now();
                    return;
                }
                if (e.type === 'pointercancel' || !pd.plate) return;
                /* a mouse click opens the layer; a first tap selects it, a second opens it */
                if (pd.type === 'mouse' || this.hover === pd.plate.i) this.go(pd.plate);
                else { this.hoverPos = { x: e.clientX, y: e.clientY }; this.setHover(pd.plate.i); }
            };
            window.addEventListener('pointerup', end);
            window.addEventListener('pointercancel', end);

            document.addEventListener('pointerdown', e => {
                if (e.pointerType !== 'mouse' && this.hover >= 0 && !st.contains(e.target)) this.setHover(-1);
            });
        }

        /* moving to another layer needs a real movement, otherwise a slab
           sliding out from under a still cursor would flip the hover back
           and forth */
        hoverAt(e, plate) {
            const idx = plate ? plate.i : -1;
            if (idx === this.hover) return;
            if (this.hover >= 0 && Math.hypot(e.clientX - this.hoverPos.x, e.clientY - this.hoverPos.y) < 16) return;
            this.hoverPos = { x: e.clientX, y: e.clientY };
            this.setHover(idx);
        }

        /* pull the layer out, open a gap above it and let the ones below settle */
        setHover(h) {
            this.hover = h;
            const gap = this.gap, s = this.s;
            for (const p of this.plates) {
                if (h < 0) { p.zT = 0; p.xT = 0; }
                else if (p.i === h) { p.zT = gap * 0.3; p.xT = s * 0.55; }
                else if (p.i > h) { p.zT = gap * 0.95; p.xT = 0; }
                else { p.zT = -gap * 0.14; p.xT = 0; }
                p.el.classList.toggle('is-active', p.i === h);
                if (this.reduced) { p.z = p.zT; p.x = p.xT; }
            }
            this.paintCard();
            this.poke();
        }

        paintCard() {
            const c = this.card, e = this.cardEls;
            if (!c || !e) return;
            const p = this.plates.find(q => q.i === this.hover);
            c.className = 'stack__card';
            if (p) {
                const key = Array.from(p.el.classList).find(k => k.startsWith('l-'));
                if (key) c.classList.add(key);
                c.dataset.state = 'layer';
                e.kicker.textContent = 'Layer ' + (5 - p.i) + ' of 5, ' + p.el.dataset.name;
                e.title.textContent = p.el.dataset.project;
                e.text.textContent = p.el.dataset.metric;
                e.go.textContent = this.touch ? 'Tap again to open this layer' : 'Click to open this layer';
            } else {
                c.dataset.state = 'idle';
                e.kicker.textContent = '';
                e.title.textContent = '';
                e.text.textContent = this.touch
                    ? 'Drag to turn it. Tap a layer to pull it out.'
                    : 'Drag to turn it. Point at a layer to pull it out.';
                e.go.textContent = '';
            }
            if (!this.reduced) { void c.offsetWidth; c.classList.add('is-swap'); }
        }

        /* dive: the whole model rushes toward you while the page scrolls to the layer */
        go(p) {
            const target = document.getElementById(p.el.dataset.goto);
            if (!target) return;
            this.diveT = 1;
            this.setHover(-1);
            const top = target.getBoundingClientRect().top + window.scrollY - 56;
            window.scrollTo({ top, behavior: this.reduced ? 'auto' : 'smooth' });
            this.poke();
        }

        onScroll() {
            const h = this.hero.offsetHeight || 1;
            const p = clamp(window.scrollY / h, 0, 1);
            this.spreadT = 1 + p * 1.35;
            if (p > 0.9) this.diveT = 0;
            this.poke();
        }

        poke() { if (this.reduced) this.render(); else this.start(); }

        start() {
            if (this.running || this.reduced) return;
            this.running = true;
            let last = 0;
            const tick = t => {
                if (!this.visible) { this.running = false; return; }
                const dt = last ? Math.min(0.033, (t - last) / 1000) : 0.016;
                last = t;
                this.step(dt, t / 1000);
                this.render();
                requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        }

        /* a slab lands: shake the assembly, ring its face, push the ones under it */
        impact(p, v) {
            const k = clamp(v / (this.s * 6), 0.15, 1);
            this.shakeV += 150 * k;
            for (const q of this.plates) {
                if (q.i < p.i && q.phase === 'spring') q.vz -= 80 * k;
            }
            p.el.classList.remove('is-hit');
            void p.el.offsetWidth;
            p.el.classList.add('is-hit');
            setTimeout(() => p.el.classList.remove('is-hit'), 760);
        }

        step(dt, t) {
            const s = this.s, g = s * 15;
            for (const p of this.plates) {
                if (p.phase === 'wait') {
                    p.delay -= dt;
                    if (p.delay > 0) continue;
                    p.phase = 'fall';
                    p.el.classList.remove('is-waiting');
                }
                if (p.phase === 'fall') {
                    p.vz -= g * dt;
                    p.z += p.vz * dt;
                    if (p.z <= 0) {
                        const v = -p.vz;
                        p.z = 0;
                        this.impact(p, v);
                        if (v < s * 0.9) { p.phase = 'spring'; p.vz = 0; }
                        else p.vz = v * 0.3;
                    }
                } else {
                    p.vz += (-170 * (p.z - p.zT) - 15 * p.vz) * dt;
                    p.z += p.vz * dt;
                }
                p.vx += (-170 * (p.x - p.xT) - 16 * p.vx) * dt;
                p.x += p.vx * dt;
            }

            this.shakeV += (-260 * this.shake - 13 * this.shakeV) * dt;
            this.shake += this.shakeV * dt;
            this.diveV += (-90 * (this.dive - this.diveT) - 14 * this.diveV) * dt;
            this.dive += this.diveV * dt;
            this.spread += (this.spreadT - this.spread) * (1 - Math.exp(-9 * dt));

            const kt = 1 - Math.exp(-6 * dt);
            this.tilt.x += (this.tiltT.x - this.tilt.x) * kt;
            this.tilt.y += (this.tiltT.y - this.tilt.y) * kt;

            /* orbit: momentum while free, then a slow return to the home angle */
            if (!this.dragging) {
                this.yaw += this.yawV * dt;
                this.yawV *= Math.exp(-3.4 * dt);
                const idle = t - this.lastInput;
                if (idle > 2.2) {
                    const home = Math.round(this.yaw / 360) * 360;
                    this.yaw += (home - this.yaw) * (1 - Math.exp(-1.6 * dt));
                }
                if (idle > 0.6) this.pitch += (0 - this.pitch) * (1 - Math.exp(-2.2 * dt));
            }
            this.t = t;
        }

        render() {
            const st = this.scene.style;
            const t = this.t || 0;
            const rz = this.HOME_RZ + this.yaw + this.tilt.x * 4 + Math.sin(t * 0.55) * 2.2;
            const rx = clamp(this.HOME_RX + this.pitch - this.tilt.y * 3 + Math.cos(t * 0.4) * 1.2, 26, 80);
            st.setProperty('--rz', rz.toFixed(2) + 'deg');
            st.setProperty('--rx', rx.toFixed(2) + 'deg');
            st.setProperty('--spread', this.spread.toFixed(3));
            st.setProperty('--sy', (this.shake + this.dive * this.s * 0.15).toFixed(2) + 'px');
            st.setProperty('--sc', (1 + this.dive * 0.6).toFixed(3));
            for (const p of this.plates) {
                p.el.style.setProperty('--dz', p.z.toFixed(1) + 'px');
                p.el.style.setProperty('--dy', p.x.toFixed(1) + 'px');
            }
        }
    }

    /* ===== Depth — which layer is under the nav bar =====
       Gives the nav the material of the current layer, moves the
       depth rail marker and highlights the matching nav link. */
    class Depth {
        constructor() {
            this.layers = Array.from(document.querySelectorAll('[data-layer]'));
            if (!this.layers.length) return;
            this.nav = document.querySelector('.nav');
            this.rail = document.querySelector('.rail');
            this.railItems = Array.from(document.querySelectorAll('[data-rail]'));
            this.links = Array.from(document.querySelectorAll('.nav__link'));
            this.contact = document.getElementById('contact');
            this.current = null;
            this.ticking = false;
            window.addEventListener('scroll', () => this.request(), { passive: true });
            window.addEventListener('resize', () => this.request(), { passive: true });
            this.update();
        }
        request() {
            if (this.ticking) return;
            this.ticking = true;
            requestAnimationFrame(() => { this.ticking = false; this.update(); });
        }
        update() {
            const probe = (this.nav ? this.nav.offsetHeight : 60) + 1;
            let layer = this.layers[0];
            for (const el of this.layers) {
                if (el.getBoundingClientRect().top <= probe) layer = el;
            }
            const key = layer.dataset.layer;
            if (key !== this.current) {
                this.current = key;
                if (this.nav) this.nav.className = this.nav.className.replace(/\bl-\w+/g, '').trim() + ' l-' + key;
            }

            const railKey = layer.id && layer.classList.contains('layer') ? layer.id : null;
            this.railItems.forEach(item => item.classList.toggle('is-current', item.dataset.rail === railKey));
            if (this.rail) this.rail.classList.toggle('is-on', !!railKey);

            let active = null;
            if (railKey) active = '#application';
            else if (key === 'bedrock') {
                const contactTop = this.contact ? this.contact.getBoundingClientRect().top : Infinity;
                active = contactTop < window.innerHeight * 0.5 ? '#contact' : '#about';
            }
            this.links.forEach(l => l.classList.toggle('is-active', l.getAttribute('href') === active));
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
                if (cached && Date.now() - cached.ts < cacheTTL) { this.render(cached.data); return; }
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
                const stars = Array.isArray(repos) ? repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0) : null;
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
                /* API unreachable or rate-limited — keep the static numbers in the markup */
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
            /* narrow screens get the last 26 weeks so the graph fits without scrolling */
            if (this.els.graph.clientWidth < 560) days = days.slice(-182);
            const svgNS = 'http://www.w3.org/2000/svg';
            const cell = 11, gap = 3;
            const startPad = new Date(days[0].date + 'T00:00:00').getDay();
            const cols = Math.ceil((startPad + days.length) / 7);
            const width = cols * (cell + gap) - gap;
            const height = 7 * (cell + gap) - gap;
            /* silicon to wafer violet, solid steps */
            const levelColors = ['#1D1E27', '#3A3566', '#5A51A3', '#8A7DE0', '#B9A9FF'];

            const svg = document.createElementNS(svgNS, 'svg');
            svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
            svg.setAttribute('width', width);
            svg.setAttribute('height', height);

            days.forEach((d, i) => {
                const idx = startPad + i;
                const rect = document.createElementNS(svgNS, 'rect');
                rect.setAttribute('x', Math.floor(idx / 7) * (cell + gap));
                rect.setAttribute('y', (idx % 7) * (cell + gap));
                rect.setAttribute('width', cell);
                rect.setAttribute('height', cell);
                rect.setAttribute('fill', levelColors[d.level] || levelColors[0]);
                const dateLabel = new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
                this.tooltip.className = 'gh__tooltip';
                this.tooltipCount = document.createElement('strong');
                this.tooltipRest = document.createTextNode('');
                this.tooltip.appendChild(this.tooltipCount);
                this.tooltip.appendChild(this.tooltipRest);
                document.body.appendChild(this.tooltip);
            }
            const tooltip = this.tooltip, margin = 8;
            const show = (rect, evt) => {
                const count = rect.dataset.count;
                this.tooltipCount.textContent = count;
                this.tooltipRest.textContent = ' ' + (count === '1' ? 'contribution' : 'contributions') + ' on ' + rect.dataset.date;
                const tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
                const left = clamp(evt.clientX - tw / 2, margin, window.innerWidth - tw - margin);
                let top = evt.clientY - th - 14;
                if (top < margin) top = evt.clientY + 18;
                tooltip.style.left = left + 'px';
                tooltip.style.top = top + 'px';
                tooltip.classList.add('is-visible');
            };
            svg.addEventListener('pointerover', e => { if (e.target.tagName === 'rect') show(e.target, e); });
            svg.addEventListener('pointermove', e => { if (e.target.tagName === 'rect') show(e.target, e); });
            svg.addEventListener('pointerout', e => { if (e.target.tagName === 'rect') tooltip.classList.remove('is-visible'); });
        }
    }

    /* ===== Live time (secondary pages) ===== */
    class NavTime {
        constructor() {
            this.el = document.querySelector('.nav__time');
            if (!this.el) return;
            this.update();
            setInterval(() => this.update(), 30000);
        }
        update() {
            this.el.textContent = new Date().toLocaleTimeString('de-DE', {
                hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Berlin'
            }) + ' in Heilbronn';
        }
    }

    /* ===== Mobile navigation ===== */
    class MobileNav {
        constructor() {
            this.nav = document.querySelector('.nav');
            this.toggle = document.querySelector('.nav__toggle');
            if (!this.nav || !this.toggle) return;
            this.open = false;
            this.toggle.addEventListener('click', () => (this.open ? this.close() : this.doOpen()));
            document.querySelectorAll('.nav__link').forEach(l => l.addEventListener('click', () => this.open && this.close()));
            document.addEventListener('keydown', e => e.key === 'Escape' && this.open && this.close());
            window.matchMedia('(min-width: 901px)').addEventListener('change', e => e.matches && this.open && this.close());
        }
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

    /* ===== External link safety ===== */
    class ExternalLinks {
        constructor() {
            document.querySelectorAll('a[target="_blank"]').forEach(a => {
                if (!a.hasAttribute('rel')) a.setAttribute('rel', 'noopener noreferrer');
            });
        }
    }

    /* ===== Lazy-load the demo video once it's near the viewport ===== */
    class LazyVideo {
        constructor() {
            const videos = document.querySelectorAll('video[data-src]');
            if (!videos.length) return;
            const obs = new IntersectionObserver(entries => {
                entries.forEach(e => {
                    if (!e.isIntersecting) return;
                    const v = e.target;
                    const source = v.querySelector('source[data-src]');
                    if (source) source.src = source.dataset.src;
                    v.load();
                    if (!prefersReducedMotion) v.play().catch(() => {});
                    obs.unobserve(v);
                });
            }, { rootMargin: '200px' });
            videos.forEach(v => obs.observe(v));
        }
    }

    /* ===== Closing mark — the name as wafer dust =====
       The outline of "Niklas Weber" is stamped once into a canvas,
       its lit pixels lifted into ~3k particles, and the pointer
       pushes them around with its own momentum before they spring
       back into the letters. Click detonates a wider shockwave. */
    class Endmark {
        constructor() {
            if (prefersReducedMotion || !finePointer) return;
            if (window.matchMedia('(max-width: 900px)').matches) return;
            this.root = document.querySelector('[data-endmark]');
            this.span = this.root ? this.root.querySelector('span') : null;
            if (!this.span) return;

            this.particles = [];
            this.ramp = this.buildRamp();
            this.px = -1e4; this.py = -1e4;
            this.pvx = 0; this.pvy = 0;
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

            new IntersectionObserver(entries => {
                entries.forEach(e => {
                    this.visible = e.isIntersecting;
                    if (this.visible) this.activate();
                });
            }, { rootMargin: '160px' }).observe(this.root);

            this.root.addEventListener('pointermove', e => this.onMove(e), { passive: true });
            this.root.addEventListener('pointerleave', () => { this.inside = false; }, { passive: true });
            this.root.addEventListener('pointerdown', e => this.blast(e), { passive: true });

            let timer;
            window.addEventListener('resize', () => {
                clearTimeout(timer);
                timer = setTimeout(() => { this.built = false; if (this.visible) this.activate(); }, 160);
            }, { passive: true });
        }

        /* cold outline to wafer violet to white */
        buildRamp() {
            const stops = [
                [0.00, 166, 162, 184],
                [0.35, 146, 128, 214],
                [0.65, 185, 169, 255],
                [0.85, 222, 212, 255],
                [1.00, 255, 255, 255]
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

        build() {
            const w = this.root.clientWidth, h = this.root.clientHeight;
            if (!w || !h) return false;
            this.w = w; this.h = h;
            this.dpr = Math.min(2, window.devicePixelRatio || 1);
            this.canvas.width = Math.round(w * this.dpr);
            this.canvas.height = Math.round(h * this.dpr);

            const ctx = this.ctx;
            const cs = getComputedStyle(this.span);
            const fs = parseFloat(cs.fontSize);
            const cy = this.span.offsetTop + this.span.offsetHeight / 2;
            const text = (this.span.textContent || '').trim();

            ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            ctx.clearRect(0, 0, w, h);

            /* Stamp on its own canvas at 3x so the counters of e, b and r
               rasterise cleanly, with the real wide axis of the typeface
               (extra-expanded is 150%, the wdth the CSS asks for) and no
               negative tracking, which would run the curves of adjacent
               letters into each other. */
            const ss = 3;
            const stamp = document.createElement('canvas');
            stamp.width = Math.round(w * ss);
            stamp.height = Math.round(h * ss);
            const sctx = stamp.getContext('2d');
            sctx.setTransform(ss, 0, 0, ss, 0, 0);

            const setFont = size => {
                sctx.font = '800 ' + size + 'px Anybody, sans-serif';
                if ('fontStretch' in sctx) sctx.fontStretch = 'extra-expanded';
                if ('letterSpacing' in sctx) sctx.letterSpacing = (size * 0.012).toFixed(2) + 'px';
            };
            let size = fs;
            setFont(size);
            const maxW = w * 0.94;
            for (let i = 0; i < 6; i++) {
                const measured = sctx.measureText(text).width;
                if (measured <= maxW || measured <= 0) break;
                size *= maxW / measured;
                setFont(size);
            }
            this.radius = size * 0.85;

            sctx.textAlign = 'center';
            sctx.textBaseline = 'middle';
            sctx.fillStyle = '#fff';
            /* fill the letters, then trace the edge of that silhouette.
               Stroking the glyph paths instead would draw every internal
               contour and every overlap between neighbouring letters,
               which is what put stray lines across the e, b and r. */
            sctx.fillText(text, w / 2, cy);

            const dw = stamp.width, dh = stamp.height;
            const img = sctx.getImageData(0, 0, dw, dh).data;
            const solid = (x, y) => (x < 0 || y < 0 || x >= dw || y >= dh) ? false : img[(y * dw + x) * 4 + 3] > 130;

            /* an edge point is filled and has at least one empty neighbour
               a lattice step away, so the outline is exactly one particle
               thick however big the letters are */
            const edges = s => {
                const out = [];
                for (let y = 0; y < dh; y += s) {
                    for (let x = 0; x < dw; x += s) {
                        if (!solid(x, y)) continue;
                        if (solid(x - s, y) && solid(x + s, y) && solid(x, y - s) && solid(x, y + s)) continue;
                        out.push(x, y);
                    }
                }
                return out;
            };
            const MAX = 6000;
            let step = ss;
            let pts = edges(step);
            while (step < ss * 5 && pts.length / 2 > MAX) { step += 1; pts = edges(step); }

            this.particles = [];
            for (let i = 0; i < pts.length; i += 2) {
                const hx = pts[i] / ss, hy = pts[i + 1] / ss;
                this.particles.push({ x: hx, y: hy, hx, hy, vx: 0, vy: 0, heat: 0, b: 0, sz: (step / ss) * 1.5 });
            }
            if (!this.particles.length) return false;

            this.built = true;
            this.root.classList.add('endmark--live');
            this.renderFrame();
            return true;
        }

        onMove(e) {
            if (!this.built) return;
            const r = this.canvas.getBoundingClientRect();
            const x = e.clientX - r.left, y = e.clientY - r.top;
            const now = performance.now(), dt = now - this.lastMove;
            if (this.lastMove && dt > 0 && dt < 120) {
                const k = 16 / dt;
                this.pvx = clamp((x - this.px) * k, -26, 26);
                this.pvy = clamp((y - this.py) * k, -26, 26);
            }
            this.lastMove = now;
            this.px = x; this.py = y;
            this.inside = true;
            this.start();
        }

        blast(e) {
            if (!this.built) return;
            const r = this.canvas.getBoundingClientRect();
            const bx = e.clientX - r.left, by = e.clientY - r.top;
            const R = this.radius * 2.2, R2 = R * R;
            for (const p of this.particles) {
                const dx = p.x - bx, dy = p.y - by, d2 = dx * dx + dy * dy;
                if (d2 >= R2) continue;
                const d = Math.sqrt(d2) || 1, f = 1 - d / R;
                p.vx += (dx / d) * f * 15 + (Math.random() - 0.5) * f * 5;
                p.vy += (dy / d) * f * 15 + (Math.random() - 0.5) * f * 5 - f * 2;
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
            const px = this.px, py = this.py, active = this.inside;
            const P = this.particles;
            let calm = !active;
            for (let i = 0; i < P.length; i++) {
                const p = P[i];
                if (active) {
                    const dx = p.x - px, dy = p.y - py, d2 = dx * dx + dy * dy;
                    if (d2 < R2) {
                        const d = Math.sqrt(d2) || 1, f = 1 - d / R, f2 = f * f;
                        p.vx += (dx / d) * f2 * 3 + this.pvx * f2 * 0.5 + (Math.random() - 0.5) * f2 * 2.2;
                        p.vy += (dy / d) * f2 * 3 + this.pvy * f2 * 0.5 + (Math.random() - 0.5) * f2 * 2.2 - f2 * 0.8;
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
            const P = this.particles, ramp = this.ramp;
            for (let b = 0; b < ramp.length; b++) {
                let set = false;
                for (let i = 0; i < P.length; i++) {
                    const p = P[i];
                    if (p.b !== b) continue;
                    if (!set) { ctx.fillStyle = ramp[b]; ctx.strokeStyle = ramp[b]; set = true; }
                    const speed = Math.abs(p.vx) + Math.abs(p.vy);
                    if (speed > 3.5) {
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

    function init() {
        new HeroStack();
        new Depth();
        new NavTime();
        new MobileNav();
        new ExternalLinks();
        new LazyVideo();
        new GitHubActivity();
        new Endmark();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
