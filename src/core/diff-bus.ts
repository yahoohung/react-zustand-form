// Lightweight batched Diff Bus with pluggable dispatch strategy.
export type DispatchStrategy = 'microtask' | 'animationFrame' | 'idle';

export type FieldPath = string;

export type FieldDiff =
  | { kind: 'update'; path: FieldPath; prev: unknown; next: unknown; rowKey?: string; column?: string; source?: 'local' | 'server' }
  | { kind: 'insert'; path: FieldPath; next: unknown; rowKey?: string; column?: string; source?: 'local' | 'server' }
  | { kind: 'remove'; path: FieldPath; prev: unknown; rowKey?: string; column?: string; source?: 'local' | 'server' }
  | { kind: 'rename'; path: FieldPath; prev: string; next: string; rowKey?: string; column?: string; source?: 'local' | 'server' };

type Listener = (batch: FieldDiff[]) => void;

export interface DiffBus {
  publish: (diff: FieldDiff | FieldDiff[]) => void;
  subscribe: (fn: Listener) => () => void;
  setStrategy: (s: DispatchStrategy) => void;
  getStrategy: () => DispatchStrategy;
}

export function createDiffBus(strategy: DispatchStrategy = 'animationFrame'): DiffBus {
  let queue: FieldDiff[] = [];
  const listeners = new Set<Listener>();
  let scheduled = false;
  let currentStrategy: DispatchStrategy = strategy;

  const flush = () => {
    scheduled = false;
    if (queue.length === 0) return;
    const batch = queue;
    queue = [];
    if (listeners.size) {
      for (const l of listeners) {
        try { l(batch); } catch { /* keep bus alive */ }
      }
    }
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;

    if (currentStrategy === 'microtask') {
      queueMicrotask(flush);
      return;
    }
    if (currentStrategy === 'animationFrame' && typeof requestAnimationFrame === 'function') {
      // Pass the flush function directly; it ignores the timestamp argument.
      requestAnimationFrame(flush as unknown as FrameRequestCallback);
      return;
    }
    if (currentStrategy === 'idle' && typeof (globalThis as any).requestIdleCallback === 'function') {
      // Pass flush directly; it ignores the IdleDeadline argument.
      (globalThis as any).requestIdleCallback(flush);
      return;
    }
    // Fallback: macrotask
    setTimeout(flush, 0);
  };

  return {
    publish(diff) {
      if (Array.isArray(diff)) {
        if (diff.length === 0) return;
        queue.push(...diff);
      } else {
        queue.push(diff);
      }
      schedule();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
    setStrategy(s) { currentStrategy = s; },
    getStrategy() { return currentStrategy; }
  };
}
