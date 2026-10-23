import { type Scene, sanitize } from './scene';

const KEY = 'minirt-studio:v1';

const r3 = (_: string, v: unknown) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v);
/** Ids are regenerated on load, so they stay out of the link. */
const noIds = (k: string, v: unknown) => (k === 'id' ? undefined : r3(k, v));

const toB64 = (bytes: Uint8Array) => {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64 = (txt: string) => {
  const b = atob(txt.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

/** A share link carries at most this much, compressed or not. A real scene is a few KB. */
const MAX_CODE = 64_000;
const MAX_BYTES = 400_000;

/** Runs bytes through a (de)compressor and gives up past `cap` output bytes. */
async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, cap = Infinity) {
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(stream).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > cap) { await reader.cancel(); throw new Error('scene too large'); }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

/** Compact, URL-safe encoding of a scene. "z." is deflated, "j." is plain JSON. */
export async function encodeScene(scene: Scene): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(scene, noIds));
  if (typeof CompressionStream === 'undefined') return 'j.' + toB64(json);
  return 'z.' + toB64(await pipe(json, new CompressionStream('deflate-raw')));
}

export async function decodeScene(code: string): Promise<Scene | null> {
  if (code.length > MAX_CODE) return null;
  try {
    const kind = code.slice(0, 2);
    let bytes = fromB64(code.slice(2));
    if (kind === 'z.') {
      if (typeof DecompressionStream === 'undefined') return null;
      bytes = await pipe(bytes, new DecompressionStream('deflate-raw'), MAX_BYTES);
    } else if (kind !== 'j.' || bytes.length > MAX_BYTES) return null;
    return sanitize(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}

export function saveLocal(scene: Scene) {
  try { localStorage.setItem(KEY, JSON.stringify(scene)); } catch { /* private mode or quota */ }
}

export function loadLocal(): Scene | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
