interface Day {
  date: string;
  count: number;
  level: number;
}

interface Stats {
  repos: number | null;
  followers: number | null;
  stars: number | null;
  commits: number | null;
  days: Day[] | null;
}

const CACHE_KEY = 'gh-stats-v3';
const CACHE_TTL = 1000 * 60 * 60 * 6;
// Monochrome: contribution levels as ink density.
const LEVELS = ['rgba(18,18,18,0.07)', 'rgba(18,18,18,0.28)', 'rgba(18,18,18,0.5)', 'rgba(18,18,18,0.75)', '#121212'];

/** Live GitHub numbers + contribution graph; the markup carries static fallbacks. */
export async function githubStats(root: HTMLElement) {
  const set = (sel: string, v: number | null) => {
    const e = root.querySelector(sel);
    if (e && v != null) e.textContent = String(v);
  };
  const render = (d: Stats) => {
    set('[data-gh-repos]', d.repos);
    set('[data-gh-stars]', d.stars);
    set('[data-gh-followers]', d.followers);
    set('[data-gh-commits]', d.commits);
    const graph = root.querySelector<HTMLElement>('[data-gh-graph]');
    if (graph && d.days?.length) graph.replaceChildren(buildGraph(d.days));
    root.classList.add('is-live');
  };

  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
    if (cached && Date.now() - cached.ts < CACHE_TTL) return render(cached.data);
  } catch {
    /* storage unavailable or corrupt */
  }

  try {
    const [userRes, reposRes, contribRes] = await Promise.all([
      fetch('https://api.github.com/users/nweber23'),
      fetch('https://api.github.com/users/nweber23/repos?per_page=100'),
      fetch('https://github-contributions-api.jogruber.de/v4/nweber23?y=last'),
    ]);
    if (!userRes.ok || !reposRes.ok) throw new Error('github api error');
    const user = await userRes.json();
    const repos = await reposRes.json();
    const data: Stats = {
      repos: user.public_repos,
      followers: user.followers,
      stars: Array.isArray(repos) ? repos.reduce((n: number, r: { stargazers_count?: number }) => n + (r.stargazers_count ?? 0), 0) : null,
      commits: null,
      days: null,
    };
    if (contribRes.ok) {
      const c = await contribRes.json();
      data.commits = c.total?.lastYear ?? null;
      data.days = c.contributions ?? null;
    }
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
    } catch {
      /* storage unavailable */
    }
    render(data);
  } catch {
    /* API unreachable or rate-limited: keep the static numbers */
  }
}

function buildGraph(days: Day[]) {
  const ns = 'http://www.w3.org/2000/svg';
  const cell = 10;
  const gap = 3;
  const pad = new Date(days[0].date + 'T00:00:00').getDay();
  const cols = Math.ceil((pad + days.length) / 7);
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${cols * (cell + gap) - gap} ${7 * (cell + gap) - gap}`);
  days.forEach((d, i) => {
    const idx = pad + i;
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', String(Math.floor(idx / 7) * (cell + gap)));
    rect.setAttribute('y', String((idx % 7) * (cell + gap)));
    rect.setAttribute('width', String(cell));
    rect.setAttribute('height', String(cell));
    rect.setAttribute('rx', '2');
    rect.setAttribute('fill', LEVELS[d.level] ?? LEVELS[0]);
    const title = document.createElementNS(ns, 'title');
    const date = new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    title.textContent = `${d.count} contribution${d.count === 1 ? '' : 's'} on ${date}`;
    rect.appendChild(title);
    svg.appendChild(rect);
  });
  return svg;
}
