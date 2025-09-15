/**
 * Lightweight batched Diff Bus with pluggable dispatch strategy.
 *
 * Batches diffs and delivers them to subscribers on a chosen schedule.
 * Strategies: microtask, animation frame, or idle callback (with fallbacks).
 */

// Lightweight batched Diff Bus with pluggable dispatch strategy.
 
/** When to flush the queued diffs. */
export type DispatchStrategy = 'microtask' | 'animationFrame' | 'idle';

/** String form of a field path. Example: "rows.user123.email". */
export type FieldPath = string;

/**
 * A change to a single field. Emitted in batches.
 *
 * Notes:
 * - `rowKey` and `column` may be omitted for non-row events.
 * - `insert` and `update` carry `next`.
 * - `remove` carries `prev`.
 * - `rename` carries the old key in `prev` and the new key in `next`.
 */
export type FieldDiff =
  | { kind: 'update'; path: FieldPath; prev: unknown; next: unknown; rowKey?: string; column?: string; source?: 'local' | 'server' }
  | { kind: 'insert'; path: FieldPath; next: unknown; rowKey?: string; column?: string; source?: 'local' | 'server' }
  | { kind: 'remove'; path: FieldPath; prev: unknown; rowKey?: string; column?: string; source?: 'local' | 'server' }
  | { kind: 'rename'; path: FieldPath; prev: string; next: string; rowKey?: string; column?: string; source?: 'local' | 'server' };

/** Receives one batch of diffs. */
type Listener = (batch: FieldDiff[]) => void;

/**
 * Diff bus public API.
 * - `publish` enqueues one diff or a batch.
 * - `subscribe` registers a listener. Returns `unsubscribe`.
 * - `setStrategy` selects the flushing schedule.
 */
export interface DiffBus {
  publish: (diff: FieldDiff | FieldDiff[]) => void;
  subscribe: (fn: Listener) => () => void;
  setStrategy: (s: DispatchStrategy) => void;
  getStrategy: () => DispatchStrategy;
}

/**
 * Create a batched diff bus.
 *
 * Listeners are called with a fresh array each time. The array is reused for the queue.
 * The schedule falls back from `animationFrame`/`idle` to `setTimeout(0)` when not available.
 *
 * @param strategy Initial dispatch strategy. Default is `animationFrame`.
 * @returns        A DiffBus instance.
 */
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
      listeners.forEach((l) => {
        try { l(batch); } catch { /* keep bus alive */ }
      });
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
      // Pass the flush function directly; it ignores the RAF timestamp parameter.
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
