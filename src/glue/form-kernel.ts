import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { createDiffBus } from '../core/diff-bus';
import { createVersionMap } from '../core/version-map';
import { createIndexStore, type IndexStoreOptions } from '../index/index-store';
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

  const diffBus = createDiffBus('animationFrame');
  const versionMap = createVersionMap();

  const indexStore = offloadToWorker
    ? createIndexStoreWorker(index)
    : createIndexStore(index);
  indexStore.rebuildFromRows(initialRows);

  // Adapt setState to the ActionGate expected signature (always replace=false for partial updates)
  const setStateSafe: (partial: Partial<FormState>, replace?: boolean, actionName?: string) => void = (partial, _replace, actionName) => {
    // We intentionally force replace=false because ActionGate always sends partial updates
    const setStateImpl = useStore.setState as unknown as (p: Partial<FormState>, replace?: boolean) => void;
    setStateImpl(partial as any, false);
  };

  let gate = createActionGate<FormState>({
    getState: useStore.getState,
    setState: setStateSafe,
    diffBus,
    versionMap,
    indexStore
  });

  if (guardInDev !== false) {
    gate = withIndexGuard(gate, useStore.getState, indexStore);
  }

  return { useStore, diffBus, versionMap, indexStore, gate };
}