// ------------------------------------------------------------
// src/plugins/backend-sync.ts (client-only optional plugin)
// ------------------------------------------------------------
import type { FormStoreApi } from '../core/types';
import { parsePath } from '../core/path';

export type ResetPolicy = 'keepDirtyValues' | 'serverWins' | 'clientWins' | 'merge';

export function createBackendSync<T>(store: FormStoreApi<T>, opts: { coalesceMs?: number; policy?: ResetPolicy } = {}) {
    const coalesceMs = opts.coalesceMs ?? 16;
    const policy = opts.policy ?? 'keepDirtyValues';
    let timer: any = null;
    let pending: Record<string, any> = {};
    let serverEpoch = 0;

    function scheduleFlush() {
        if (timer) return;
        timer = setTimeout(() => {
            const snapshot = pending; pending = {}; timer = null; serverEpoch++;
            // Record to store (for DevTools/observation)
            store.setState((s) => ({ ...s, serverState: { ...(s.serverState ?? {}), ...snapshot } }), false, { type: `${store.getState().name} server:flush(${serverEpoch})` });
            // Conditional DOM overwrite: only not-dirty
            const st: any = store.getState();
            const dirty = st.formState?.dirtyFields ?? {};
            const refs = st.__domRefs ?? {};
            for (const p of Object.keys(snapshot)) {
                if (policy === 'clientWins' || (policy !== 'serverWins' && dirty[p])) continue;
                const ref = refs[p];
                if (ref?.current && String(ref.current.value) !== String(snapshot[p])) {
                    ref.current.value = String(snapshot[p] ?? '');
                }
            }
        }, coalesceMs);
    }

    return {
        pushServerPatch(patch: Partial<Record<string, any>>) {
            Object.assign(pending, patch);
            scheduleFlush();
        },
        dispose() { if (timer) clearTimeout(timer); timer = null; pending = {}; }
    };
}
