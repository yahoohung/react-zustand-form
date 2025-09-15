import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { createDiffBus } from '../core/diff-bus';
import { createVersionMap } from '../core/version-map';
import { createIndexStore, type IndexStoreOptions } from '../index/column-index-store';
import { createIndexStoreWorker } from '../index/index-store.worker';
import { createActionGate } from '../core/action-gate';
import { withIndexGuard } from '../core/with-index-guard';

type Rows = Record<string, Record<string, unknown>>;

export interface FormState { rows: Rows; }

export interface KernelOptions {
  index?: IndexStoreOptions;
  offloadToWorker?: boolean; // default false
  guardInDev?: boolean;      // default true
}

export function createFormKernel(initialRows: Rows, options: KernelOptions = {}) {
  const { index, offloadToWorker = false, guardInDev = true } = options;

  const useStore = create<FormState>()(subscribeWithSelector((set) => ({ rows: initialRows })));

  // DEV ONLY: detect direct setState calls that bypass ActionGate (which would desync index/version/diff).
  if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production' && guardInDev !== false) {
    const originalSetState = useStore.setState as unknown as (p: Partial<FormState>, replace?: boolean, actionName?: string) => void;
    (useStore.setState as any) = (p: Partial<FormState>, replace?: boolean, actionName?: string) => {
      const label = actionName ?? '';
      const fromGate = typeof label === 'string' && (label.startsWith('gate:') || label.startsWith('kernel/'));
      if (!fromGate) {
        // Point to the logical owner by printing a short stack.
        const err = new Error('[RZF] Direct useStore.setState() detected. Route mutations via ActionGate to keep index/version/diff consistent.');
        // eslint-disable-next-line no-console
        console.warn(err.stack || err.message);
      }
      try {
        return originalSetState(p as any, replace as any, actionName);
      } catch {
        return originalSetState(p as any, replace as any);
      }
    };
  }

  const diffBus = createDiffBus('animationFrame');
  const versionMap = createVersionMap();

  const indexStore = offloadToWorker
    ? createIndexStoreWorker(index)
    : createIndexStore(index);
  // IMPORTANT: After init, all row mutations must flow through ActionGate to keep index/version/diffs in sync.
  // Avoid calling useStore.setState(...) directly for rows; the DEV patch above will warn if that happens.
  indexStore.rebuildFromRows(initialRows);

  // Adapt setState to the ActionGate expected signature (always replace=false for partial updates)
  const setStateSafe: (partial: Partial<FormState>, replace?: boolean, actionName?: string) => void = (partial, _replace, actionName) => {
    // We intentionally force replace=false because ActionGate always sends partial updates
    const setStateImpl = useStore.setState as unknown as (p: Partial<FormState>, replace?: boolean, actionName?: string) => void;

    // Forward action names if the store is enhanced by devtools middleware (it reads the 3rd arg).
    // Fallback to a default action label to keep traces meaningful.
    const label = actionName ?? 'gate:set';

    // Record last action name for quick debugging (safe no-op in production)
    try { (globalThis as any).__RZF_LAST_ACTION__ = label; } catch {}

    // Some Zustand setups won't accept a 3rd arg; call signature-tolerant.
    try {
      setStateImpl(partial as any, false, label);
    } catch {
      setStateImpl(partial as any, false);
    }
  };

  let gate = createActionGate<FormState>({
    getState: useStore.getState,
    setState: setStateSafe,
    diffBus,
    versionMap,
    indexStore
  });

  // Only attach heavy guards in development. In production, skip for performance.
  if (guardInDev !== false && typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
    gate = withIndexGuard(gate, useStore.getState, indexStore);
  }

  return { useStore, diffBus, versionMap, indexStore, gate };
}