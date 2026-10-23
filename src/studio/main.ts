import '@fontsource-variable/inter';
import '@fontsource/anton';
import '@fontsource/space-mono/400.css';
import '../styles/base.css';
import '../styles/studio.css';
import { Inspector, SWATCHES } from './inspector';
import { PRESETS } from './presets';
import { parseRt, serializeRt } from './rt';
import {
  type Item, type Kind, type Scene, LIMITS, canAdd, countOf, defaultMat, insertItem, itemLabel, newId, removeItem,
} from './scene';
import { decodeScene, encodeScene, loadLocal, saveLocal } from './share';
import { Store } from './store';
import { Viewport } from './viewport';
import { add, dot, mul, rayPlane, round, type Vec3 } from './math';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

// --- status toast -------------------------------------------------------------

const toast = $('#toast');
let toastTimer = 0;
function status(msg: string) {
  toast.textContent = msg;
  toast.classList.add('is-on');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('is-on'), 3200);
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function copy(text: string, field?: HTMLInputElement | HTMLTextAreaElement) {
  try {
    await navigator.clipboard.writeText(text);
    status('Copied to clipboard.');
  } catch {
    // Clipboard API needs a secure context and a user gesture; fall back to selecting.
    field?.focus();
    field?.select();
    status('Select the text and copy it with Ctrl+C.');
  }
}

// --- boot ------------------------------------------------------------------------

async function startScene(): Promise<{ scene: Scene; fromLink: boolean; badLink: boolean }> {
  const m = /^#s=(.+)$/.exec(location.hash);
  if (m) {
    const shared = await decodeScene(m[1]);
    if (shared) return { scene: shared, fromLink: true, badLink: false };
    return { scene: loadLocal() ?? PRESETS[0].build(), fromLink: false, badLink: true };
  }
  return { scene: loadLocal() ?? PRESETS[0].build(), fromLink: false, badLink: false };
}

const boot = await startScene();
const store = new Store(boot.scene);

let viewport: Viewport | null = null;
try {
  viewport = new Viewport({
    stage: $('#stage'),
    canvas: $<HTMLCanvasElement>('#render'),
    overlay: $<HTMLCanvasElement>('#overlay'),
    store,
    onStatus: status,
  });
  viewport.resetOrbit();
  viewport.onStats = (t) => { $('#stats').textContent = t; };
} catch (err) {
  console.error(err);
  $('#fallback').hidden = false;
  $('#stats').textContent = 'no WebGL2';
}

const inspector = new Inspector($('#inspector'), store, status);

// --- panels ------------------------------------------------------------------------

const studio = $('#studio');
const tabs = [...document.querySelectorAll<HTMLButtonElement>('.tabs__btn')];
function setTab(name: string) {
  studio.dataset.tab = name;
  tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
}
tabs.forEach((t) => t.addEventListener('click', () => setTab(t.dataset.tab!)));
const narrow = window.matchMedia('(max-width: 960px)');

const olist = $('#olist');
function renderList() {
  const scene = store.scene;
  const items: Item[] = [...scene.lights, ...scene.shapes];
  $('#count').textContent = `${items.length}`;
  olist.replaceChildren();
  if (!items.length) {
    const li = document.createElement('li');
    li.className = 'olist__empty';
    li.textContent = 'The scene is empty. Add a shape above.';
    olist.append(li);
  }
  for (const it of items) {
    const li = document.createElement('li');
    li.className = 'olist__row';
    const pick = document.createElement('button');
    pick.type = 'button';
    pick.className = 'olist__item';
    pick.setAttribute('aria-pressed', String(it.id === store.selectedId));
    const sw = document.createElement('span');
    sw.className = 'olist__swatch';
    const c = it.kind === 'light' ? it.color : it.mat.color;
    sw.style.background = `rgb(${c[0]},${c[1]},${c[2]})`;
    if (it.kind === 'light') sw.classList.add('olist__swatch--light');
    const name = document.createElement('span');
    name.textContent = itemLabel(scene, it);
    pick.append(sw, name);
    pick.addEventListener('click', () => store.select(it.id));
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'olist__del';
    del.textContent = '×';
    del.setAttribute('aria-label', `Delete ${itemLabel(scene, it)}`);
    del.addEventListener('click', () => {
      store.apply((s) => removeItem(s, it.id));
      if (store.selectedId === it.id) store.select(null);
    });
    li.append(pick, del);
    olist.append(li);
  }
  document.querySelectorAll<HTMLButtonElement>('[data-add]').forEach((b) => {
    const kind = b.dataset.add as Kind;
    const full = !canAdd(scene, kind);
    b.disabled = full;
    b.title = '';
    if (full) b.title = `Limit reached: ${countOf(scene, kind)} of ${LIMITS[kind]} ${kind}s`;
  });
}

function renderPresets() {
  const list = $('#plist');
  for (const p of PRESETS) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'plist__item';
    const n = document.createElement('span');
    n.className = 'plist__name';
    n.textContent = p.name;
    const note = document.createElement('span');
    note.className = 'plist__note';
    note.textContent = p.note;
    b.append(n, note);
    b.addEventListener('click', () => {
      store.replace(p.build());
      viewport?.resetOrbit();
      status(`Loaded “${p.name}”. Undo brings your last scene back.`);
    });
    li.append(b);
    list.append(li);
  }
}

// --- adding things ------------------------------------------------------------------

let colourIndex = 0;
const nextColour = () => SWATCHES[colourIndex++ % SWATCHES.length];

/** Where a new object lands: on the floor in front of the camera. */
function spawnPoint(): Vec3 {
  const v = viewport?.view;
  const cam = store.scene.camera;
  const pos = v?.pos ?? cam.pos;
  const ray = v ? v.ray(v.w / 2, v.h * 0.62) : cam.dir;
  const hit = rayPlane(pos, ray, [0, 0, 0], [0, 1, 0]);
  const p: Vec3 = hit && dot(add(hit, mul(pos, -1)), ray) < 60 ? hit : add(pos, mul(ray, 6));
  return [round(p[0], 0.1), 0, round(p[2], 0.1)];
}

function addItem(kind: Kind) {
  if (!canAdd(store.scene, kind)) { status(`The shader holds at most ${LIMITS[kind]} of these.`); return; }
  const p = spawnPoint();
  let item: Item;
  if (kind === 'sphere') item = { id: newId(), kind, center: [p[0], 1, p[2]], radius: 1, mat: defaultMat(nextColour()) };
  else if (kind === 'plane') item = { id: newId(), kind, point: p, normal: [0, 1, 0], mat: defaultMat([225, 225, 225]) };
  else if (kind === 'cylinder') item = { id: newId(), kind, center: [p[0], 1, p[2]], axis: [0, 1, 0], radius: 0.6, height: 2, mat: defaultMat(nextColour()) };
  else if (kind === 'cone') item = { id: newId(), kind, center: [p[0], 1.1, p[2]], axis: [0, 1, 0], radius: 0.8, height: 2.2, mat: defaultMat(nextColour()) };
  else item = { id: newId(), kind, pos: [p[0], 4, p[2]], brightness: 0.6, color: [255, 255, 255] };
  store.apply((s) => insertItem(s, item));
  store.select(item.id);
}
document.querySelectorAll<HTMLButtonElement>('[data-add]').forEach((b) => b.addEventListener('click', () => addItem(b.dataset.add as Kind)));

// --- toolbar -------------------------------------------------------------------------

const undoBtn = $<HTMLButtonElement>('#undo');
const redoBtn = $<HTMLButtonElement>('#redo');
undoBtn.addEventListener('click', () => store.undo());
redoBtn.addEventListener('click', () => store.redo());
const syncHistory = () => { undoBtn.disabled = !store.canUndo; redoBtn.disabled = !store.canRedo; };

const quality = $<HTMLSelectElement>('#quality');
quality.addEventListener('change', () => viewport?.setQuality(quality.value === 'native' ? 'native' : Number(quality.value)));
const snap = $<HTMLInputElement>('#snap');
snap.addEventListener('change', () => { if (viewport) viewport.snap = snap.checked; });

// Import
const dlgImport = $<HTMLDialogElement>('#dlg-import');
const importText = $<HTMLTextAreaElement>('#import-text');
const importIssues = $('#import-issues');
function listIssues(host: HTMLElement, items: string[]) {
  host.replaceChildren(...items.map((t) => { const li = document.createElement('li'); li.textContent = t; return li; }));
}
function loadRt(text: string) {
  if (text.length > 400_000) { status('That file is too large for a scene.'); return false; }
  const { scene, issues } = parseRt(text);
  const empty = !scene.shapes.length && !scene.lights.length;
  if (empty && issues.length) {
    listIssues(importIssues, ['Nothing could be read from this text.', ...issues.slice(0, 12)]);
    return false;
  }
  store.replace(scene);
  viewport?.resetOrbit();
  listIssues(importIssues, issues.slice(0, 12));
  status(issues.length ? `Loaded with ${issues.length} note${issues.length > 1 ? 's' : ''}.` : 'Scene loaded.');
  return true;
}
$('#import').addEventListener('click', () => { listIssues(importIssues, []); dlgImport.showModal(); importText.focus(); });
$('#import-go').addEventListener('click', () => {
  if (loadRt(importText.value) && !importIssues.children.length) dlgImport.close();
});
$<HTMLInputElement>('#import-file').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (file.size > 400_000) { status('That file is too large for a scene.'); return; }
  importText.value = await file.text();
});

// Dropping a file anywhere on the view loads it.
const stage = $('#stage');
stage.addEventListener('dragover', (e) => { e.preventDefault(); stage.classList.add('is-drop'); });
stage.addEventListener('dragleave', () => stage.classList.remove('is-drop'));
stage.addEventListener('drop', async (e) => {
  e.preventDefault();
  stage.classList.remove('is-drop');
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;
  if (file.size > 400_000) { status('That file is too large for a scene.'); return; }
  const ok = loadRt(await file.text());
  if (!ok) { importText.value = ''; dlgImport.showModal(); }
});

// Export
const dlgExport = $<HTMLDialogElement>('#dlg-export');
const exportText = $<HTMLTextAreaElement>('#export-text');
$('#export').addEventListener('click', () => {
  const s = store.scene;
  exportText.value = serializeRt(s);
  const notes: string[] = [];
  if (s.lights.length === 0) notes.push('No light in the scene. Most miniRT parsers require exactly one.');
  if (s.lights.length > 1) notes.push(`${s.lights.length} lights. The mandatory part allows one; extra lights need the bonus parser.`);
  if (s.shapes.some((x) => x.kind === 'cone')) notes.push('Cones are written as "co x,y,z axis diameter height colour" with x,y,z at the centre of the base. Check that your parser reads the same layout.');
  if (s.lights.some((l) => l.color.some((c) => c !== 255))) notes.push('A coloured light is written as a fourth value, which only a bonus parser reads.');
  if (s.shapes.some((x) => x.mat.reflect > 0 || x.mat.checker) || s.look.bounces > 0) notes.push('Mirrors, checkerboards and specular settings are studio-only and are not in the file.');
  listIssues($('#export-notes'), notes);
  dlgExport.showModal();
});
$('#export-copy').addEventListener('click', () => copy(exportText.value, exportText));
$('#export-dl').addEventListener('click', () => {
  download(new Blob([exportText.value], { type: 'text/plain' }), 'scene.rt');
  status('Downloaded scene.rt.');
});

// Share
const dlgShare = $<HTMLDialogElement>('#dlg-share');
const shareUrl = $<HTMLInputElement>('#share-url');
$('#share').addEventListener('click', async () => {
  const code = await encodeScene(store.scene);
  shareUrl.value = `${location.origin}${location.pathname}#s=${code}`;
  dlgShare.showModal();
  shareUrl.select();
});
$('#share-copy').addEventListener('click', () => copy(shareUrl.value, shareUrl));

// PNG
$('#png').addEventListener('click', async () => {
  if (!viewport) { status('The render needs WebGL2.'); return; }
  status('Rendering 1920 px wide…');
  const blob = await viewport.capture(1920);
  if (!blob) { status('The browser could not encode the image.'); return; }
  download(blob, 'minirt-studio.png');
  status('Saved minirt-studio.png.');
});

for (const d of [dlgImport, dlgExport, dlgShare]) {
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
}

// --- keyboard ---------------------------------------------------------------------------

addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement;
  const typing = t.matches('input:not([type=checkbox]):not([type=range]), textarea, select') || t.isContentEditable;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? store.redo() : store.undo(); return; }
  if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); store.redo(); return; }
  if (typing || document.querySelector('dialog[open]')) return;
  if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); inspector.duplicate(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && store.selected) { e.preventDefault(); inspector.remove(); return; }
  if (e.key === 'Escape') store.select(null);
});

// --- wiring --------------------------------------------------------------------------------

let saveTimer = 0;
let listSig = '';
/** Rebuild the object list only when what it shows has changed. */
function refreshList() {
  const sc = store.scene;
  const sig = [store.selectedId, ...[...sc.lights, ...sc.shapes].map((i) => `${i.id}${i.kind === 'light' ? i.color : i.mat.color}`)].join('|')
    + `|${LIMITS.light}${sc.lights.length}${sc.shapes.length}`;
  if (sig === listSig) return;
  listSig = sig;
  renderList();
}

store.on((c) => {
  if (c === 'selection') {
    inspector.rebuild();
    if (store.selectedId && narrow.matches) setTab('inspector');
  } else if (c === 'scene') {
    inspector.sync();
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => saveLocal(store.scene), 400);
  }
  refreshList();
  syncHistory();
});

refreshList();
renderPresets();
syncHistory();

if (boot.badLink) status('That share link could not be read. Showing your last scene instead.');
else if (boot.fromLink) status('Scene loaded from the link. Your own scene is untouched until you edit this one.');
