// Main-thread proxy for IndexStore via Web Worker.
// Falls back to in-thread store if Worker is unavailable.

import { createIndexStore, type IndexStore, type IndexStoreOptions } from './index-store';
import { resolveModuleUrl } from '../utils/resolveModuleUrl';

type Snapshot = Record<string, { byRow: Record<string, unknown> }>;

// Cache for a last-known snapshot to satisfy sync snapshot() signature
let lastSnapshot: Snapshot = {};
let snapshotDirty = true;
let inflight = false;       // prevent duplicate snapshot requests
let latestReqId = 0;        // only accept the newest snapshot reply
const calls = new Map<number, (data: Snapshot) => void>();

export function createIndexStoreWorker(opts: IndexStoreOptions = {}): IndexStore {
  if (typeof Worker === 'undefined') {
    // SSR / Node / No Worker: fall back to local store
    return createIndexStore(opts);
  }

  const base = resolveModuleUrl(__dirname, (globalThis as any).__WORKER_BASE_URL__);
  const worker = new Worker(new URL('./worker/index-worker.ts', base), { type: 'module' });  // Inject the real impl factory into worker global for initialisation handshake.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (worker as any).__indexStoreImpl = (o: IndexStoreOptions) => createIndexStore(o);

  worker.postMessage({ kind: 'init', opts });

  worker.onmessage = (ev: MessageEvent<any>) => {
    const m = ev.data;
    if (m?.kind === 'snapshot' && typeof m.id === 'number') {
      // accept only the latest response; drop stale
      if (m.id === latestReqId) {
        lastSnapshot = (m.data ?? {}) as Snapshot;
        snapshotDirty = false;
        inflight = false;
        const fn = calls.get(m.id);
        if (fn) fn(lastSnapshot);
      }
      // clean resolver for this id (latest or stale)
      calls.delete(m.id);
      return;
    }
    if (m?.kind === 'error') {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.warn('[index-store.worker] error from worker:', m);
      }
      inflight = false;
      return;
    }
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('[index-store.worker] unknown message:', m);
    }
  };

  const askSnapshot = () =>
    new Promise<Snapshot>(res => {
      const id = ++latestReqId;
      calls.set(id, res);
      worker.postMessage({ kind: 'snapshot', id });
    });

  const refreshSnapshotIfDirty = () => {
    if (snapshotDirty && !inflight) {
      inflight = true;
      void askSnapshot().catch(() => { inflight = false; });
    }
  };

  return {
    getColumn: (_col: string) => { throw new Error('getColumn() is not supported on worker proxy; use snapshot()'); },
    setCell: (col, rowKey, value) => { worker.postMessage({ kind: 'setCell', col, rowKey, value }); snapshotDirty = true; refreshSnapshotIfDirty(); },
    removeRow: (rowKey) => { worker.postMessage({ kind: 'removeRow', rowKey }); snapshotDirty = true; refreshSnapshotIfDirty(); },
    renameRow: (oldKey, newKey) => { worker.postMessage({ kind: 'renameRow', oldKey, newKey }); snapshotDirty = true; refreshSnapshotIfDirty(); },
    rebuildFromRows: (rows) => { worker.postMessage({ kind: 'rebuildFromRows', rows }); snapshotDirty = true; refreshSnapshotIfDirty(); },
    snapshot: () => {
      // return last-known snapshot synchronously; refresh in background if needed
      refreshSnapshotIfDirty();
      return lastSnapshot;
    },
    reset: () => { worker.postMessage({ kind: 'reset' }); snapshotDirty = true; refreshSnapshotIfDirty(); }
  };
}