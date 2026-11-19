// Usage: node scripts/i18n.mjs   (needs `npx vite --port 5199` running and google-chrome)
// Dumps every page's English blocks to src/i18n/en.txt and lists the ones missing from src/i18n/de.txt.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const pages = ['index.html', 'writing.html', 'imprint.html', 'minirt-studio.html',
  ...['projects', 'writing'].flatMap((d) => readdirSync(d).filter((f) => f.endsWith('.html')).map((f) => `${d}/${f}`))];
const seen = new Map();
let out = '';
for (const p of pages) {
  const html = execFileSync('google-chrome', ['--headless=new', '--no-sandbox', '--virtual-time-budget=15000', '--dump-dom',
    `http://localhost:5199/${p}?i18n=dump`], { maxBuffer: 1 << 28 }).toString();
  const m = html.match(/<pre id="i18n-dump">([\s\S]*?)<\/pre>/);
  if (!m) { console.error('no dump for', p); continue; }
  const json = JSON.parse(m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
  let block = '';
  for (const [k, v] of Object.entries(json)) if (!seen.has(k)) { seen.set(k, v); block += `@@ ${k}\n${v}\n`; }
  out += `# ${p}\n${block}`;
}
writeFileSync('src/i18n/en.txt', out);
const have = new Set([...readFileSync('src/i18n/de.txt', 'utf8').matchAll(/^@@ (\S+)$/gm)].map((m) => m[1]));
const missing = [...seen.keys()].filter((k) => !have.has(k));
writeFileSync('src/i18n/todo.txt', out.split(/^(?=# )/m).map((s) => s.split(/^(?=@@ )/m).filter((b) => !b.startsWith('@@') || !have.has(b.split('\n')[0].slice(3))).join('')).filter((s) => s.includes('@@')).join(''));
console.log(`${seen.size} blocks, ${missing.length} untranslated`);
