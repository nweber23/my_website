import { type Item, type Scene, findItem } from './scene';

type Camera = Scene['camera'];
/** The camera is a view, not content: it stays out of undo unless the whole scene is swapped. */
interface Snap { json: string; cam: Camera | null }

export type Change = 'scene' | 'selection' | 'history';

const LIMIT = 100;
const SETTLE_MS = 500;

/** The scene, the selection, and an undo history over whole-scene snapshots. */
export class Store {
  scene: Scene;
  selectedId: string | null = null;
  private past: Snap[] = [];
  private future: Snap[] = [];
  private pending: Snap | null = null;
  private settle = 0;
  private listeners = new Set<(c: Change) => void>();

  constructor(scene: Scene) {
    this.scene = scene;
  }

  on(fn: (c: Change) => void) {
    this.listeners.add(fn);
  }

  private snap(withCamera = false): Snap {
    const { camera, ...rest } = this.scene;
    return { json: JSON.stringify(rest), cam: withCamera ? structuredClone(camera) : null };
  }

  private emit(c: Change) {
    this.listeners.forEach((fn) => fn(c));
  }

  get selected(): Item | undefined {
    return findItem(this.scene, this.selectedId);
  }

  get canUndo() { return this.past.length > 0 || this.pending !== null; }
  get canRedo() { return this.future.length > 0; }

  select(id: string | null) {
    if (this.selectedId === id) return;
    this.selectedId = id;
    this.emit('selection');
  }

  /** Start a gesture. Everything until end() becomes one undo step. */
  begin() {
    window.clearTimeout(this.settle);
    if (this.pending === null) this.pending = this.snap();
  }

  mutate(fn: (s: Scene) => void) {
    fn(this.scene);
    this.emit('scene');
  }

  end() {
    window.clearTimeout(this.settle);
    if (this.pending === null) return;
    if (this.pending.json !== this.snap().json) {
      this.past.push(this.pending);
      if (this.past.length > LIMIT) this.past.shift();
      this.future = [];
      this.emit('history');
    }
    this.pending = null;
  }

  /** One discrete edit. */
  apply(fn: (s: Scene) => void) {
    this.begin();
    this.mutate(fn);
    this.end();
  }

  /** A burst of edits (typing, slider drags) that settles into one undo step. */
  tweak(fn: (s: Scene) => void) {
    this.begin();
    this.mutate(fn);
    window.clearTimeout(this.settle);
    this.settle = window.setTimeout(() => this.end(), SETTLE_MS);
  }

  private restore(snap: Snap) {
    const camera = snap.cam ?? this.scene.camera;
    this.scene = { ...JSON.parse(snap.json), camera } as Scene;
    if (this.selectedId && !findItem(this.scene, this.selectedId)) this.selectedId = null;
    this.emit('selection');
    this.emit('scene');
    this.emit('history');
  }

  undo() {
    this.end();
    const prev = this.past.pop();
    if (prev === undefined) return;
    this.future.push(this.snap(prev.cam !== null));
    this.restore(prev);
  }

  redo() {
    this.end();
    const next = this.future.pop();
    if (next === undefined) return;
    this.past.push(this.snap(next.cam !== null));
    this.restore(next);
  }

  /** Replace everything (preset, import). Undoable. */
  replace(scene: Scene) {
    this.end();
    this.past.push(this.snap(true));
    if (this.past.length > LIMIT) this.past.shift();
    this.future = [];
    this.scene = scene;
    this.selectedId = null;
    this.emit('selection');
    this.emit('scene');
    this.emit('history');
  }
}
