import type { ActionGate } from './action-gate';
import type { IndexStore } from '../index/index-store';
import { assertIndexes } from './dev-assert';

export function withIndexGuard<S extends { rows: Record<string, any> }>(
  gate: ActionGate,
  getState: () => S,
  indexStore: IndexStore
): ActionGate {
  if (process.env.NODE_ENV === 'production') return gate;

  const wrap = <T extends (...a: any[]) => any>(fn: T) => {
    return ((...args: any[]) => {
      const ret = fn(...(args as Parameters<T>));
      queueMicrotask(() => {
        try { assertIndexes(getState().rows, indexStore); } catch { /* already logged */ }
      });
      return ret;
    }) as T;
  };

  return {
    applyPatches: wrap(gate.applyPatches),
    updateField: wrap(gate.updateField),
    addRow: wrap(gate.addRow),
    removeRow: wrap(gate.removeRow),
    renameRow: wrap(gate.renameRow)
  };
}