// ------------------------------------------------------------
// Portions adapted from react-sweet-state (MIT License)
// ------------------------------------------------------------
/**
 * Form store factory and micro-batcher.
 *
 * The store is a vanilla Sweet-Store instance (no React import at call sites).
 * The batcher coalesces keyed payloads into microtasks.
 */
import type { FormStoreApi, FormStoreState } from './types';
import { createSweetStore } from './sweet-store';

/** Public shape of the batcher returned by {@link createBatcher}. */
export type Batcher<TKey extends string = string, TPayload = unknown> = ReturnType<typeof createBatcher<TKey, TPayload>>;

/**
 * Creates a micro-batcher for keyed payloads.
 *
 * Last write wins per key within the same microtask. Insertion order is kept.
 * Optional `max` evicts the oldest entries when full. Use `max <= 0` to keep
 * only the most recent entry (size never exceeds 1).
 * If `useTransition` is true and `startTransition` exists, the flush runs in a transition.
 *
 * @param cfg Optional config. `{ max?: number; useTransition?: boolean }`.
 * @returns An object with a single `push(key, payload, flush)` method.
 */
export function createBatcher<TKey extends string = string, TPayload = unknown>(cfg: { max?: number; useTransition?: boolean } = {}) {
    const max = cfg.max ?? 1000;
    const canTrans = !!cfg.useTransition && typeof (globalThis as any).startTransition === 'function';
    const startTrans: ((fn: () => void) => void) | null = canTrans ? (globalThis as any).startTransition : null;

    // Maintain insertion order and last-write-wins payloads
    const q = new Map<TKey, TPayload>();
    let scheduled = false;
    let batchFlush: ((k: TKey, p: TPayload) => void) | null = null;

    // Reentrancy: pushes during flush schedule the next microtask (not this batch).
    const flushNow = () => {
        scheduled = false;
        const fn = batchFlush;
        const run = () => {
            try {
                if (fn) {
                    q.forEach((p, k) => {
                        try { fn(k, p); } catch { /* keep batch alive */ }
                    });
                }
            } finally {
                q.clear();
                batchFlush = null;
            }
        };
        if (startTrans) startTrans(run); else run();
    };

    const schedule = () => {
        if (scheduled) return;
        scheduled = true;
        queueMicrotask(flushNow);
    };

    // Eviction policy:
    // - limit <= 0  => keep only the most recent entry (size stays <= 1)
    // - limit > 0   => cap at `limit`, evicting the oldest on insert when full.
    const evictOldest = (limit: number) => {
        if (limit <= 0) {
            // Keep only the most recent entry: always drop oldest before inserting.
            const it = q.keys().next();
            if (!it.done) q.delete(it.value);
            return;
        }
        if (q.size >= limit) {
            const it = q.keys().next();
            if (!it.done) q.delete(it.value);
        }
    };

    return {
        push(key: TKey, payload: TPayload, flush: (k: TKey, p: TPayload) => void) {
            // Pin the flusher for this batch to the first push that schedules it.
            // Later pushes in the same batch do not override the flusher.
            if (!scheduled) batchFlush = flush;

            // Insert or update payload (keeps original insertion order)
            if (!q.has(key)) {
                evictOldest(max);
            }
            q.set(key, payload);

            schedule();
        }
    };
}

/**
 * Creates a sweet-store powered store for one form instance.
 *
 * No React dependency. DevTools can be enabled in development.
 * The store exposes a small API compatible with the rest of the library.
 *
 * @template T Shape of the form values.
 * @param name     Debug name for DevTools.
 * @param initial  Initial values object.
 * @param devtools Enable Redux DevTools integration in development builds.
 * @returns        A `FormStoreApi<T>` facade.
 */
export function createFormStore<T>(name: string, initial: T, devtools: boolean): FormStoreApi<T> {
    const base: FormStoreState<T> = {
        name: name || 'rzf',
        __initial: initial,
        formState: { dirtyFields: {}, touchedFields: {}, errors: {} },
        resolverEpoch: 0,
    };

    const sweet = createSweetStore<FormStoreState<T>>(base, { name, devtools });

    return {
        getState: sweet.getState,
        setState: (updater, replace, action) => {
            sweet.setState((current) => updater(current), replace, action);
        },
        subscribe: (fn) => sweet.subscribe(fn),
    };
}
