import { createSweetStore } from '../core/sweet-store';
import { createDiffBus } from '../core/diff-bus';
import { createVersionMap } from '../core/version-map';
import { createIndexStore, type IndexStoreOptions } from '../index/column-index-store';
import { createActionGate } from '../core/action-gate';
import { createKernelEngine } from '../kernel/engine';
import type { KernelCommit, KernelRows } from '../kernel/types';
import { createFlushScheduler, type FlushStrategy } from '../kernel/scheduler';

export interface KernelOptions {
  index?: IndexStoreOptions;
  guardInDev?: boolean;
  devtools?: boolean;
  name?: string;
  /** Frame flush strategy: `raf` (default), `microtask`, or `immediate`. */
  flushStrategy?: FlushStrategy;
}

export interface FormState { rows: KernelRows; }

function cloneInitialRows(rows: KernelRows): KernelRows {
  const next: KernelRows = {};
  Object.keys(rows ?? {}).forEach((rowKey) => {
    next[rowKey] = { ...(rows[rowKey] ?? {}) };
  });
  return next;
}

export function createFormKernel(initialRows: KernelRows, options: KernelOptions = {}) {
  const {
    index: indexOptions,
    guardInDev = true,
    devtools = false,
    name = 'kernel',
    flushStrategy = 'raf',
  } = options;

  const store = createSweetStore<FormState>({ rows: cloneInitialRows(initialRows) }, { name, devtools });
 const diffBus = createDiffBus('animationFrame');
 const versionMap = createVersionMap();
 const indexStore = createIndexStore(indexOptions);
  indexStore.rebuildFromRows(store.getState().rows);

  let lastCommitLabel = 'kernel/init';

  const flush = (() => {
    let scheduled = false;
    let pending: KernelCommit | null = null;
    const trigger = createFlushScheduler(flushStrategy, () => {
      scheduled = false;
      if (!pending) return;
      const commit = pending;
      pending = null;
      lastCommitLabel = commit.label;
      store.setState(() => ({ rows: commit.rows }), true, { type: commit.label });
      diffBus.publish(commit.diffs);
    });

    return (commit: KernelCommit) => {
      pending = pending
        ? {
            rows: commit.rows,
            diffs: [...pending.diffs, ...commit.diffs],
            label: commit.label,
            actionCount: pending.actionCount + commit.actionCount,
          }
        : commit;
      if (!scheduled) {
        scheduled = true;
        trigger();
      }
    };
  })();

  const engine = createKernelEngine(
    {
      initialRows: store.getState().rows,
      indexStore,
      versionMap,
      sourceLabel: name,
    },
    flush,
  );

  const gate = createActionGate(engine);

  if (!guardInDev || process.env.NODE_ENV === 'production') {
    return { useStore: store.useStore, diffBus, versionMap, indexStore, gate };
  }

  const wrappedGate = new Proxy(gate, {
    get(target, key) {
      const original = (target as any)[key];
      if (typeof original !== 'function') return original;
      return (...args: unknown[]) => {
        const label = typeof key === 'string' ? `gate:${key}` : 'gate:call';
        try {
          (globalThis as any).__RZF_LAST_ACTION__ = label;
        } catch {
          // no-op
        }
        return original(...args);
      };
    }
  }) as typeof gate;

  return { useStore: store.useStore, diffBus, versionMap, indexStore, gate: wrappedGate };
}
