// ------------------------------------------------------------
// src/core/hooks.tsx
// ------------------------------------------------------------
import React from 'react';
import type { DirtyMap, FormErrors, FormState, FormStoreApi, UseFormOptions, RegisterOptions } from '../core/types';
import { getAtPath, setAtPath, parsePath } from '../core/path';
import { createFormStore, createBatcher } from '../core/store';

const Ctx = React.createContext<FormStoreApi<any> | null>(null);

export function useForm<T>(opts: UseFormOptions<T>) {
    const name = opts.name || 'rzf';
    const storeRef = React.useRef<FormStoreApi<T>>();
    if (!storeRef.current) {
        storeRef.current = createFormStore<T>(name, opts.defaultValues, !!opts.devtools);
    }
    const store = storeRef.current!;

    // local UI mirrors (optional; consumers may read store directly)
    const [formState, setFormState] = React.useState<FormState>(store.getState().formState);

    React.useEffect(() => {
        const unsub = store.subscribe((s) => setFormState(s.formState));
        return () => unsub();
    }, [store]);

    // --- resolver (async-safe with epoch)
    const runResolverAndApply = React.useCallback(async (values: T) => {
        if (!opts.resolver) return;
        const token = ++store.getState().resolverEpoch;
        try {
            const result = await opts.resolver(values);
            if (token !== store.getState().resolverEpoch) return; // outdated
            const errors = result?.errors ?? {};
            store.setState((s) => ({ ...s, formState: { ...s.formState, errors } }), false, { type: `${name} resolver:ok` });
        } catch (err: any) {
            if (token !== store.getState().resolverEpoch) return;
            const errors: FormErrors = { _root: String(err?.message ?? err) };
            store.setState((s) => ({ ...s, formState: { ...s.formState, errors } }), false, { type: `${name} resolver:err` });
        }
    }, [name, opts.resolver, store]);

    // --- Provider
    const Provider: React.FC<React.PropsWithChildren<{}>> = React.useCallback(({ children }) => {
        return <Ctx.Provider value={store}> {children} </Ctx.Provider>;
    }, [store]);

    // --- register (supports uncontrolled)
    function register(path: string, ropts: RegisterOptions = {}) {
        const parts = parsePath(path);
        const def = getAtPath(opts.defaultValues as any, parts as any);
        if (ropts.uncontrolled) {
            return {
                name: path,
                defaultValue: def as any,
                ref: (el: HTMLInputElement | null) => {
                    if (!el) return;
                    const st = store.getState();
                    const refs = st.__domRefs ?? (st.__domRefs = {});
                    refs[path] = { current: el };
                },
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                    const now = e.currentTarget.value;
                    const isDirty = String(now) !== String(def ?? '');
                    store.setState((s) => ({ ...s, formState: { ...s.formState, dirtyFields: { ...s.formState.dirtyFields, [path]: isDirty } } }), false, { type: `${name} field:dirty` });
                },
                onBlur: () => {
                    store.setState((s) => ({ ...s, formState: { ...s.formState, touchedFields: { ...s.formState.touchedFields, [path]: true } } }), false, { type: `${name} field:touched` });
                }
            } as const;
        }
        // controlled (minimal): bind through store.value (not fully featured; MVP)
        return {
            name: path,
            value: getAtPath((store.getState() as any).value ?? (opts.defaultValues as any), parts as any) ?? '',
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                const v = e.currentTarget.value;
                let nextValLocal: any;
                store.setState((s) => {
                    const prev = (s as any).value ?? (opts.defaultValues as any);
                    const nextVal = setAtPath(prev, parts as any, v);
                    nextValLocal = nextVal; // capture for resolver
                    const dirty: DirtyMap = {
                        ...s.formState.dirtyFields,
                        [path]: String(v) !== String(def ?? ''),
                    };
                    return { ...s, value: nextVal, formState: { ...s.formState, dirtyFields: dirty } } as any;
                }, false, { type: `${name} field:set` });

                // Schedule resolver in a microtask to avoid reentrancy and to play nice with tests
                const enqueue = (cb: () => void) =>
                    typeof queueMicrotask === 'function'
                        ? queueMicrotask(cb)
                        : Promise.resolve().then(cb);
                enqueue(() => runResolverAndApply(nextValLocal as T));
            },
            onBlur: () => {
                store.setState((s) => ({ ...s, formState: { ...s.formState, touchedFields: { ...s.formState.touchedFields, [path]: true } } }), false, { type: `${name} field:touched` });
            }
        } as const;
    }

    // --- handleSubmit (collects uncontrolled via refs; controlled via state)
    const handleSubmit = (fn: (values: T) => void) => (e?: React.FormEvent) => {
        e?.preventDefault?.();
        // Uncontrolled: read from DOM
        const st = store.getState();
        const refs = st.__domRefs ?? {};
        const fromDom: any = JSON.parse(JSON.stringify(opts.defaultValues));
        Object.keys(refs).forEach((p) => {
            const el = refs[p]?.current; if (!el) return;
            // best-effort: write string value
            const parts = parsePath(p);
            const prev = getAtPath(fromDom, parts);
            const v = el.value;
            const next = setAtPath(fromDom, parts, v);
            Object.assign(fromDom, next);
        });
        fn(fromDom);
    };

    return { Provider, register, handleSubmit, formState, store } as const;
}

export function useFormStore<T>() {
    const ctx = React.useContext(Ctx);
    if (!ctx) throw new Error('useFormStore must be used under Provider');
    return ctx as FormStoreApi<T>;
}



