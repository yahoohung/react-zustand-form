import { createIndexStoreWorker } from '../src/index/index-store.worker';

// Helper to get at the most recent Worker instance & swap its impl
function getLastMockWorker(): any {
  // Our MockWorker is the global Worker constructor; we can’t directly access instances,
  // so we create one throwaway and capture “this”. Easiest is to monkey-patch new Worker.
  // But simpler: rely on the fact our proxy constructs exactly one Worker per store.
  // We'll intercept by creating the store and then walking the captured instance via a symbol.
  // Instead, here we just assert via runtime behavior; to point __indexStoreImpl, we do:
  return (globalThis as unknown as { __lastWorker?: any }).__lastWorker;
}

// Patch Worker ctor to record last instance (only within this test file)
const OriginalWorker = globalThis.Worker as any;
beforeAll(() => {
  (globalThis as any).Worker = function PatchedWorker(url: URL, opts: any) {
    const inst = new (OriginalWorker as any)(url, opts);
    (globalThis as any).__lastWorker = inst;
    return inst;
  };
});
afterAll(() => { (globalThis as any).Worker = OriginalWorker; });

describe('createIndexStoreWorker proxy', () => {
  test('initial snapshot is empty, then refreshes via async snapshot message', async () => {
    const store = createIndexStoreWorker({});
    const worker = getLastMockWorker();
    // Replace the injected impl with our in-memory store
    worker.__indexStoreImpl = (_opts: unknown) => (globalThis as any).__createInMemoryIndexStore();

    // First sync call returns lastSnapshot (empty), but triggers async askSnapshot()
    const s0 = store.snapshot();
    expect(s0).toEqual({});

    // Now modify state via proxy -> worker
    store.setCell('colA', 'r1', 123);
    store.setCell('colA', 'r2', 456);
    store.setCell('colB', 'r1', 'x');

    // Depending on proxy impl, snapshot refresh may happen immediately or on next call.
    const expected = {
      colA: { byRow: { r1: 123, r2: 456 } },
      colB: { byRow: { r1: 'x' } }
    };
    const mid = store.snapshot();
    if (Object.keys(mid).length === 0) {
      const s2 = store.snapshot();
      expect(s2).toEqual(expected);
    } else {
      expect(mid).toEqual(expected);
    }
  });

  test('removeRow and renameRow are forwarded and reflected after refresh', () => {
    const store = createIndexStoreWorker({});
    const worker = getLastMockWorker();
    worker.__indexStoreImpl = (_opts: unknown) => (globalThis as any).__createInMemoryIndexStore();

    // Build some state using setCell to avoid worker-specific rebuild semantics
    store.setCell('colA', 'r1', 1);
    store.setCell('colB', 'r1', 'a');
    store.setCell('colA', 'r2', 2);
    store.setCell('colB', 'r2', 'b');
    // Trigger refresh
    void store.snapshot();

    // rename r1 -> r10
    store.renameRow('r1', 'r10');
    void store.snapshot(); // refresh

    let snap = store.snapshot();
    expect(snap).toEqual({
      colA: { byRow: { r10: 1, r2: 2 } },
      colB: { byRow: { r10: 'a', r2: 'b' } }
    });

    // remove r2
    store.removeRow('r2');
    void store.snapshot();
    snap = store.snapshot();
    expect(snap).toEqual({
      colA: { byRow: { r10: 1 } },
      colB: { byRow: { r10: 'a' } }
    });
  });

  test('reset clears everything after refresh', () => {
    const store = createIndexStoreWorker({});
    const worker = getLastMockWorker();
    worker.__indexStoreImpl = (_opts: unknown) => (globalThis as any).__createInMemoryIndexStore();

    store.setCell('col', 'row', 9);
    void store.snapshot(); // refresh
    expect(store.snapshot()).toEqual({ col: { byRow: { row: 9 } } });

    store.reset();
    void store.snapshot(); // refresh
    expect(store.snapshot()).toEqual({});
  });

  test('getColumn throws as documented', () => {
    const store = createIndexStoreWorker({});
    const worker = getLastMockWorker();
    worker.__indexStoreImpl = (_opts: unknown) => (globalThis as any).__createInMemoryIndexStore();

    expect(() => store.getColumn('col')).toThrow(/not supported on worker proxy/i);
  });
});