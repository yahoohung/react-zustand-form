import '@testing-library/jest-dom';

// A minimal deterministic MockWorker that lives in the same thread.
// It understands the message protocol your proxy uses.

type AnyFn = (...args: any[]) => any;

class MockWorker {
  // Public API expected by the proxy:
  onmessage: ((ev: MessageEvent<any>) => void) | null = null;

  // Storage for your "injected" factory (the proxy does: (worker as any).__indexStoreImpl = ...)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  __indexStoreImpl?: (opts: any) => IndexStoreLike;

  private store?: IndexStoreLike;
  private lastId = 0;

  constructor(_url: URL, _opts: { type?: string } = {}) {}

  // Proxy posts messages here; we emulate worker thread logic synchronously.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  postMessage(msg: any) {
    if (msg?.kind === 'init') {
      // Build real store using injected factory
      if (!this.__indexStoreImpl) throw new Error('MockWorker: __indexStoreImpl missing');
      this.store = this.__indexStoreImpl(msg.opts ?? {});
      return;
    }

    if (!this.store) throw new Error('MockWorker: store not initialised');

    switch (msg.kind) {
      case 'setCell':
        this.store.setCell(msg.col, msg.rowKey, msg.value);
        break;
      case 'removeRow':
        this.store.removeRow(msg.rowKey);
        break;
      case 'renameRow':
        this.store.renameRow(msg.oldKey, msg.newKey);
        break;
      case 'rebuildFromRows':
        this.store.rebuildFromRows(msg.rows);
        break;
      case 'reset':
        this.store.reset();
        break;
      case 'snapshot': {
        // Reply with current snapshot & echo id
        const payload = {
          data: this.store.snapshot(),
          id: msg.id,
          kind: 'snapshot'
        };
        this.emitMessage(payload);
        break;
      }
      default:
        throw new Error(`MockWorker: unknown kind ${String(msg.kind)}`);
    }
  }

  terminate() {/* not used */}

  // Utility to emit back to the proxy
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private emitMessage(data: any) {
    this.lastId++;
    const ev = { data } as MessageEvent<any>;
    this.onmessage?.(ev);
  }
}

// Very small “IndexStore” shape your worker expects (keeps tests hermetic)
interface IndexStoreLike {
  getColumn(col: string): Record<string, unknown>;
  setCell(col: string, rowKey: string, value: unknown): void;
  removeRow(rowKey: string): void;
  renameRow(oldKey: string, newKey: string): void;
  rebuildFromRows(rows: Array<{ key: string; [k: string]: unknown }>): void;
  snapshot(): Record<string, { byRow: Record<string, unknown> }>;
  reset(): void;
}

// A tiny in-memory implementation (mirrors the API used by your proxy)
function createInMemoryIndexStore(): IndexStoreLike {
  // by column: { [col]: { byRow: { [rowKey]: value } } }
  const state: Record<string, { byRow: Record<string, unknown> }> = {};

  return {
    getColumn(col) {
      return state[col]?.byRow ?? {};
    },
    setCell(col, rowKey, value) {
      state[col] ??= { byRow: {} };
      state[col].byRow[rowKey] = value;
    },
    removeRow(rowKey) {
      for (const col of Object.keys(state)) {
        if (rowKey in state[col].byRow) delete state[col].byRow[rowKey];
      }
    },
    renameRow(oldKey, newKey) {
      for (const col of Object.keys(state)) {
        const val = state[col].byRow[oldKey];
        if (oldKey in state[col].byRow) {
          delete state[col].byRow[oldKey];
          state[col].byRow[newKey] = val;
        }
      }
    },
    rebuildFromRows(rows) {
      // Reset and rebuild columns based on provided row objects
      for (const col of Object.keys(state)) delete state[col];
      for (const row of rows) {
        const { key, ...rest } = row as Record<string, unknown>;
        for (const [col, v] of Object.entries(rest)) {
          const colKey = String(col);
          state[colKey] ??= { byRow: {} };
          state[colKey].byRow[String(key)] = v;
        }
      }
    },
    snapshot() {
      // Deep-ish copy sufficient for test immutability checks
      const out: Record<string, { byRow: Record<string, unknown> }> = {};
      for (const [col, { byRow }] of Object.entries(state)) {
        out[col] = { byRow: { ...byRow } };
      }
      return out;
    },
    reset() {
      for (const col of Object.keys(state)) delete state[col];
    }
  };
}

// Expose MockWorker to tests and to the proxy under test
Object.defineProperty(globalThis, 'Worker', {
  configurable: true,
  writable: true,
  value: MockWorker
});

// Patch URL to be harmless in Node/jsdom
// (the proxy calls `new URL('./worker/index-worker.ts', import.meta.url)`)
if (!(globalThis as any).URL || typeof (globalThis as any).URL !== 'function') {
  (globalThis as any).URL = class URL { constructor(public url: string, _base?: string) {} } as any;
}

// IMPORTANT: the proxy writes `(worker as any).__indexStoreImpl = (...) => createIndexStore(o)`
// We want that to resolve to our in-memory store for tests.
// We can’t intercept that write directly here, but our MockWorker keeps the property.
// The “real” function is created in the test file (via import) and assigned by the proxy.
// To make sure it works without your app’s real implementation, we override
// global factory by re-exporting a named symbol the proxy will call.
// However, your proxy *does not* import this; it injects at runtime.
// Therefore: in tests we’ll spy on the created Worker instance and replace
// `__indexStoreImpl` to return `createInMemoryIndexStore()`.
(globalThis as any).__createInMemoryIndexStore = createInMemoryIndexStore;

// Provide a deterministic base URL for index-store.worker.ts during tests.
// Our MockWorker ignores the URL, but this prevents any URL constructor surprises.
(globalThis as any).__WORKER_BASE_URL__ = `file://${process.cwd()}/src/index/`;