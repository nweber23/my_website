/**
 * EN/DE. The HTML stays English; with lang=de every text block whose normalised innerHTML
 * hashes to a key in i18n/de.txt is swapped for its German version. Anything without an
 * entry stays English, so new copy never breaks. Switching reloads the page (no animation state to repair).
 *
 * Dev helper: open any page with ?i18n=dump to get the English blocks as JSON in #i18n-dump,
 * then `node scripts/i18n.mjs` turns those into src/i18n/en.txt and lists what is still untranslated.
 */
export type Lang = 'en' | 'de';

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
/** FNV-1a, base 36. Must match scripts/i18n.mjs. */
export function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

function pick(): Lang {
  try {
    const s = localStorage.getItem('lang');
    if (s === 'en' || s === 'de') return s;
  } catch { /* storage blocked: fall through */ }
  return navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en';
}

export const lang: Lang = pick();
document.documentElement.lang = lang;

const dict = new Map<string, string>();
/** Translate a string from script. Falls back to the English input. */
export const t = (en: string) => dict.get(en) ?? dict.get(hash(norm(en))) ?? en;

const SKIP = 'script,style,svg,canvas,pre,code,kbd,samp,[translate="no"],.lang';
const ATTRS = ['alt', 'aria-label', 'title', 'placeholder'];
const META = 'meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"]';
const hasText = (e: Element) => [...e.childNodes].some((n) => n.nodeType === 3 && /\p{L}/u.test(n.nodeValue!));

/** Link tags are keyed as a bare <a>, so a block translates once however its links are written. */
const A = /<a\b[^>]*>/g;

/** Calls fn for every translatable thing: text blocks, attributes, <title>, meta. */
function visit(fn: (key: string, en: string, set: (v: string) => void) => void) {
  const unit = (en: string, set: (v: string) => void, html = false) => {
    const tags = html ? en.match(A) ?? [] : [];
    en = norm(html ? en.replace(A, '<a>') : en);
    // A German <a> gets the original tag (href, target, rel) back, in order.
    if (en) fn(hash(en), en, (v) => { let i = 0; set(tags.length ? v.replace(A, (m) => tags[i++] ?? m) : v); });
  };
  const walk = (e: Element) => {
    if (e.matches(SKIP)) return;
    if (hasText(e)) return unit(e.innerHTML, (v) => (e.innerHTML = v), true);
    for (const c of e.children) walk(c);
  };
  unit(document.title, (v) => (document.title = v));
  document.querySelectorAll<HTMLMetaElement>(META).forEach((m) => unit(m.content, (v) => (m.content = v)));
  walk(document.body);
  document.querySelectorAll(ATTRS.map((a) => `body [${a}]`).join()).forEach((e) => {
    if (e.closest(SKIP)) return;
    for (const a of ATTRS) if (e.hasAttribute(a)) unit(e.getAttribute(a)!, (v) => e.setAttribute(a, v));
  });
}

function parse(raw: string) {
  for (const part of raw.split(/^@@ /m).slice(1)) {
    const nl = part.indexOf('\n');
    if (nl > 0) dict.set(part.slice(0, nl).trim(), part.slice(nl + 1).trim());
  }
}

if (import.meta.env.DEV && location.search.includes('i18n=dump')) {
  const out: Record<string, string> = {};
  visit((k, en) => (out[k] = en));
  const pre = document.createElement('pre');
  pre.id = 'i18n-dump';
  pre.textContent = JSON.stringify(out);
  document.documentElement.append(pre);
} else if (lang === 'de') {
  parse((await import('./i18n/de.txt?raw')).default);
  visit((k, _en, set) => { const v = dict.get(k); if (v) set(v); });
}

// --- the switch: one small fixed pill, same on every page and viewport ------------------------
function mountSwitch() {
  const box = document.createElement('div');
  box.className = 'lang';
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', t('Language'));
  for (const l of ['en', 'de'] as const) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = l.toUpperCase();
    b.lang = l;
    b.setAttribute('aria-pressed', String(l === lang));
    b.onclick = () => {
      if (l === lang) return;
      try { localStorage.setItem('lang', l); } catch { /* ignore */ }
      location.reload();
    };
    box.append(b);
  }
  document.body.append(box);
}
mountSwitch();
