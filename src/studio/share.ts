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

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Compact, URL-safe encoding of a scene. "z." is deflated, "j." is plain JSON. */
export async function encodeScene(scene: Scene): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(scene, noIds));
  if (typeof CompressionStream === 'undefined') return 'j.' + toB64(json);
  return 'z.' + toB64(await pipe(json, new CompressionStream('deflate-raw')));
}

export async function decodeScene(code: string): Promise<Scene | null> {
  try {
    const kind = code.slice(0, 2);
    let bytes = fromB64(code.slice(2));
    if (kind === 'z.') {
      if (typeof DecompressionStream === 'undefined') return null;
      bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    } else if (kind !== 'j.') return null;
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
