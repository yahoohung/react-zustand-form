/**
 * Development helper to wrap an ActionGate with index validation.
 *
 * In production this simply returns the gate unchanged.
 * In development it wraps each method and checks the index store
 * against the current rows after every call.
 */
import type { ActionGate } from './action-gate';
import type { IndexStore } from '../index/column-index-store';
import { assertIndexes } from './dev-assert';

/**
 * Wraps an ActionGate to assert that index data stays correct.
 * Only active in non‑production builds.
 *
 * After each wrapped call, a microtask checks that the index
 * matches the current rows. Any mismatch is logged by `assertIndexes`.
 *
 * @template S Store state type containing a `rows` branch.
 * @param gate       The original ActionGate to wrap.
 * @param getState   Returns the latest store state.
 * @param indexStore IndexStore instance to validate.
 * @returns          A new ActionGate with the same API but with index checks.
 */
export function withIndexGuard<S extends { rows: Record<string, any> }>(
  gate: ActionGate,
  getState: () => S,
  indexStore: IndexStore
): ActionGate {
  if (process.env.NODE_ENV === 'production') return gate;

  /**
   * Creates a wrapper for a single gate method.
   * Calls the original and then schedules an index check.
   */
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
    // All ActionGate methods are wrapped to perform index checks in dev mode.
    applyPatches: wrap(gate.applyPatches),
    updateField: wrap(gate.updateField),
    addRow: wrap(gate.addRow),
    removeRow: wrap(gate.removeRow),
    renameRow: wrap(gate.renameRow)
  };
}