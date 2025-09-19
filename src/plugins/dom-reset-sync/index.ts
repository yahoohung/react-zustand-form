/**
 * DOM Reset Sync (client-only optional plugin).
 *
 * Coalesces server patches and applies them to the form store and DOM inputs.
 * Aims to avoid flicker and fights with user typing by using a reset policy.
 */
// ------------------------------------------------------------
// src/plugins/dom-reset-sync.ts (client-only optional plugin)
// ------------------------------------------------------------
import type { FormStoreApi } from '../../core/types';

/**
 * How to resolve conflicts between server values and local edits.
 *
 * - `keepDirtyValues`: Do not overwrite fields the user has touched.
 * - `serverWins`: Always take the server value.
 * - `clientWins`: Never overwrite current input values.
 * - `merge`: Apply server value if the input is empty, otherwise keep local.
 */

export type ResetPolicy = 'keepDirtyValues' | 'serverWins' | 'clientWins' | 'merge';

/** Public API returned by {@link createDomResetSync}. */
export interface DomResetSync {
  /** Queue a batch of server values (path -> value). */
  pushServerPatch(patch: Partial<Record<string, unknown>>): void;
  /** Cancel timers and clear pending state. */
  dispose(): void;
}

/**
 * Create a lightweight DOM reset sync helper.
 *
 * Queues server patches and flushes them in a small time window (default 16ms).
 * On flush it updates the store's `serverState` for observability and, based on
 * the selected policy, may update live DOM input values to match the server.
 *
 * @template T Shape of the form values.
 * @param store   The form store API to read and write state.
 * @param opts    Optional settings.
 * @param opts.coalesceMs  Time window for coalescing patches. Defaults to 16ms.
 * @param opts.policy      Conflict policy. Defaults to `keepDirtyValues`.
 * @returns       A small API with `pushServerPatch` and `dispose`.
 */
export function createDomResetSync<T>(
  store: FormStoreApi<T>,
  opts: { coalesceMs?: number; policy?: ResetPolicy } = {}
): DomResetSync {
  const coalesceMs = opts.coalesceMs ?? 16;
  const policy: ResetPolicy = opts.policy ?? 'keepDirtyValues';
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: Record<string, unknown> = {};
  let serverEpoch = 0;

  function scheduleFlush() {
    if (timer) return;
    timer = setTimeout(() => {
      const snapshot = pending; pending = {}; timer = null; serverEpoch++;
      // Record to store for DevTools/observation. Shallow merge is enough here.
      store.setState(
        (s) => ({ ...s, serverState: { ...(s as any).serverState ?? {}, ...snapshot } }),
        false,
        { type: `${store.getState().name} server:flush(${serverEpoch})` }
      );

      // Conditional DOM overwrite according to the chosen policy.
      const st: any = store.getState();
      const dirty: Record<string, boolean> = (st.formState?.dirtyFields ?? {}) as Record<string, boolean>;
      const refs: Record<string, { current?: { value: unknown } }> = (st.__domRefs ?? {}) as Record<string, { current?: { value: unknown } }>;

      // Index-based loop to satisfy ESLint rules that restrict `for..of`.
      const keys = Object.keys(snapshot);
      for (let i = 0; i < keys.length; i++) {
        const p = keys[i];
        const nextVal = (snapshot as Record<string, unknown>)[p];

        // Decide if we should write into the DOM input based on policy.
        if (policy === 'clientWins') continue;
        if (policy === 'keepDirtyValues' && dirty[p]) continue;
        if (policy === 'merge') {
          const ref = refs[p];
          const cur = ref?.current?.value;
          // If current is empty-ish, prefer server. Otherwise keep local.
          const empty = cur === '' || cur === null || cur === undefined;
          if (!empty) continue;
        }

        const ref = refs[p];
        if (ref?.current && String(ref.current.value) !== String(nextVal)) {
          ref.current.value = String(nextVal ?? '');
        }
      }
    }, coalesceMs);
  }

  const api: DomResetSync = {
    pushServerPatch(patch: Partial<Record<string, unknown>>) {
      Object.assign(pending, patch);
      scheduleFlush();
    },
    dispose() { if (timer) clearTimeout(timer); timer = null; pending = {}; }
  };
  return api;
}
