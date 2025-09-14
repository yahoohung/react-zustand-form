// ------------------------------------------------------------
// src/core/store.ts
// ------------------------------------------------------------
import { createStore } from 'zustand/vanilla';
import { subscribeWithSelector } from 'zustand/middleware';
import type { FormStoreApi, FormStoreState, FormState } from './types';

export type Batcher = ReturnType<typeof createBatcher>;

export function createBatcher(cfg: { max?: number; useTransition?: boolean } = {}) {
    const max = cfg.max ?? 1000;
    const canTrans = !!cfg.useTransition && typeof (globalThis as any).startTransition === 'function';
    const startTrans: ((fn: () => void) => void) | null = canTrans ? (globalThis as any).startTransition : null;

    // Maintain insertion order and last-write-wins payloads
    const q = new Map<string, any>();
    let scheduled = false;
    let batchFlush: ((k: string, p: any) => void) | null = null;

    // Reentrancy: pushes during flush schedule the next microtask (not this batch).
    const flushNow = () => {
        scheduled = false;
        const fn = batchFlush;
        const run = () => {
            try {
                if (fn) {
                    for (const [k, p] of q) {
                        try { fn(k, p); } catch { /* keep batch alive */ }
                    }
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
        push(key: string, payload: any, flush: (k: string, p: any) => void) {
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

export function createFormStore<T>(name: string, initial: T, devtools: boolean): FormStoreApi<T> {
    const base: FormStoreState<T> = {
        name: name || 'rzf',
        __initial: initial,
        formState: { dirtyFields: {}, touchedFields: {}, errors: {} },
        resolverEpoch: 0,
    };

    const withMw = (creator: any) => {
        if (process.env.NODE_ENV !== 'production' && devtools) {
            // lazily import to avoid ESM/CJS interop issues at module top-level
            const { devtools: applyDevtools } = require('zustand/middleware'); // or await import(...) if you switch this fn to async
            return applyDevtools(subscribeWithSelector(creator), { name });
        }
        return subscribeWithSelector(creator);
    };
    // Create vanilla store (no React dependency here)
    const storeImpl = createStore<FormStoreState<T>>(withMw(() => base));

    return {
        getState: storeImpl.getState,
        setState: (updater, _replace, action) => {
            const next = updater(storeImpl.getState());
            const s = (storeImpl as any).setState;
            if (action && s.length >= 3) {
                // single call with action label (devtools)
                s(next as any, true, action);
            } else {
                // standard vanilla signature
                s(next as any, true);
            }
        },
        subscribe: (fn) => storeImpl.subscribe(fn),
    };
}