// ------------------------------------------------------------
// src/core/store.ts
// ------------------------------------------------------------
import { createStore } from 'zustand/vanilla';
import { subscribeWithSelector } from 'zustand/middleware';
import type { FormStoreApi, FormStoreState, FormState } from './types';

export type Batcher = ReturnType<typeof createBatcher>;

export function createBatcher(cfg: { max?: number; useTransition?: boolean } = {}) {
    const max = cfg.max ?? 1000;
    const useTrans = !!cfg.useTransition;
    let q: Record<string, any> = {};
    let order: string[] = [];
    let scheduled = false;
    const schedule = (run: () => void) => {
        if (scheduled) return; scheduled = true;
        queueMicrotask(() => {
            scheduled = false;
            if (useTrans && typeof (globalThis as any).startTransition === 'function') {
                (globalThis as any).startTransition(run);
            } else run();
        });
    };
    return {
        push(key: string, payload: any, flush: (k: string, p: any) => void) {
            if (!(key in q)) order.push(key);
            q[key] = payload;                 // merge: keep last per key
            if (order.length > max) order.shift(); // drop oldest key to cap
            schedule(() => {
                const keys = order; order = [];
                const payloads = q; q = {};
                for (const k of keys) flush(k, payloads[k]);
            });
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

    const withMw = (creator: any) => (
        (process.env.NODE_ENV !== 'production' && devtools)
            ? (require('zustand/middleware').devtools as any)(subscribeWithSelector(creator), { name })
            : subscribeWithSelector(creator)
    );

    // Create vanilla store (no React dependency here)
    const storeImpl = createStore<FormStoreState<T>>(withMw(() => base));

    return {
        getState: storeImpl.getState,
        setState: (updater, _replace, action) => {
            const next = updater(storeImpl.getState());
            // vanilla setState signature: (partial, replace?)
            storeImpl.setState(next as any, true);
            if ((storeImpl as any).setState.length >= 3 && action) {
                // devtools action label
                (storeImpl as any).setState(next as any, true, action);
            }
        },
        subscribe: (fn) => storeImpl.subscribe(fn),
    };
}