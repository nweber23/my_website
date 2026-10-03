// The machine as a stack of layers, from a packet on the wire down to the
// execution units of one core. Every number in the readouts comes from here.

import { SUBJECTS, type Subject } from './subjects';

export type LayerKey = 'net' | 'os' | 'ram' | 'cache' | 'core';

export interface Layer {
  key: LayerKey;
  code: string;
  name: string;
  /** Typical access latency for this layer, ns. */
  latency: number;
  /** What one access at this layer looks like. */
  op: string;
  color: number;
  subject: Subject;
}

const subject = (id: string) => SUBJECTS.find((s) => s.id === id)!;

export const LAYERS: Layer[] = [
  {
    key: 'net',
    code: 'NET',
    name: 'Network',
    latency: 10_000_000,
    op: 'WebSocket frame, one round trip',
    color: 0xff5a1f,
    subject: subject('transcendence'),
  },
  {
    key: 'os',
    code: 'OS',
    name: 'Kernel & processes',
    latency: 100_000,
    op: 'fork() + execve() of a small program',
    color: 0x9be37a,
    subject: subject('minishell'),
  },
  {
    key: 'ram',
    code: 'RAM',
    name: 'Main memory',
    latency: 80,
    op: 'DRAM access after a cache miss',
    color: 0xe9b65b,
    subject: subject('elo'),
  },
  {
    key: 'cache',
    code: 'L2',
    name: 'Cache',
    latency: 4,
    op: 'L2 hit, one 64-byte line',
    color: 0x6fd3e8,
    subject: subject('go-renderer'),
  },
  {
    key: 'core',
    code: 'CORE',
    name: 'Execution core',
    latency: 1,
    op: 'L1 hit feeding the SIMD units',
    color: 0xd8d2c8,
    subject: subject('minirt'),
  },
];

/** Index of the layer a project lives on. */
export function layerOf(subjectIndex: number) {
  const id = SUBJECTS[subjectIndex].id;
  return LAYERS.findIndex((l) => l.subject.id === id);
}

export const CLOCK_GHZ = 4;

/**
 * Depth runs continuously from 0 (network) to LAYERS.length - 1 (core).
 * Between two layers, latency is interpolated on a log scale.
 */
export function latencyAt(depth: number) {
  const d = Math.max(0, Math.min(LAYERS.length - 1, depth));
  const i = Math.min(LAYERS.length - 2, Math.floor(d));
  const f = d - i;
  const a = Math.log10(LAYERS[i].latency);
  const b = Math.log10(LAYERS[i + 1].latency);
  return 10 ** (a + (b - a) * f);
}

export function formatLatency(ns: number) {
  if (ns >= 1e6) return `${(ns / 1e6).toFixed(ns >= 1e7 ? 0 : 1)} ms`;
  if (ns >= 1e3) return `${(ns / 1e3).toFixed(ns >= 1e4 ? 0 : 1)} µs`;
  if (ns >= 10) return `${ns.toFixed(0)} ns`;
  return `${ns.toFixed(ns >= 2 ? 1 : 2)} ns`;
}

/** The classic intuition pump: stretch time so that 1 ns lasts 1 s. */
export function humanScale(ns: number) {
  const s = ns;
  if (s < 90) return `${s.toFixed(s < 10 ? 1 : 0)} s`;
  if (s < 5400) return `${(s / 60).toFixed(0)} min`;
  if (s < 172800) return `${(s / 3600).toFixed(1)} h`;
  if (s < 60 * 86400) return `${(s / 86400).toFixed(1)} days`;
  if (s < 2 * 31557600) return `${(s / 2629800).toFixed(1)} months`;
  return `${(s / 31557600).toFixed(1)} years`;
}

export function cycles(ns: number) {
  const c = ns * CLOCK_GHZ;
  if (c >= 1e6) return `${(c / 1e6).toFixed(1)} M`;
  if (c >= 1e3) return `${(c / 1e3).toFixed(1)} k`;
  return c.toFixed(c < 10 ? 1 : 0);
}

/** Cache levels behind the core: L1, L2, L3, then DRAM. */
const HIERARCHY = [1, 4, 12, 80];

/**
 * Average memory access time with the same hit rate h at every cache level:
 * AMAT = t1 + (1-h)(t2 + (1-h)(t3 + (1-h)·t_mem)).
 */
export function amat(h: number) {
  let t = HIERARCHY[HIERARCHY.length - 1];
  for (let i = HIERARCHY.length - 2; i >= 0; i--) t = HIERARCHY[i] + (1 - h) * t;
  return t;
}

export const HIT_RATES = [0.5, 0.9, 0.99] as const;
export const SIMD_WIDTHS = [1, 4, 8] as const;
export const simdName = (w: number) => (w === 1 ? 'scalar' : w === 4 ? 'SSE ×4' : 'AVX ×8');
