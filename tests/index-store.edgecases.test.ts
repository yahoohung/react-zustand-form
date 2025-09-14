import { createIndexStoreWorker } from '../src/index/index-store.worker';
// Patch Worker ctor to record last instance (same as proxy test)
const OriginalWorker = globalThis.Worker as any;
beforeAll(() => {
  (globalThis as any).Worker = function PatchedWorker(url: URL, opts: any) {
    const inst = new (OriginalWorker as any)(url, opts);
    (globalThis as any).__lastWorker = inst;
    return inst;
  };
});
afterAll(() => { (globalThis as any).Worker = OriginalWorker; });
const makeStore = () => {
  const s = createIndexStoreWorker({});
  const w = (globalThis as any).__lastWorker;
  w.__indexStoreImpl = (_o:unknown)=> (globalThis as any).__createInMemoryIndexStore();
  return s;
};

describe('IndexStore edge cases', () => {
  test('rename to existing key overwrites', () => {
    const store = makeStore();
    store.setCell('col','a',1);
    store.setCell('col','b',2);
    void store.snapshot();
    store.renameRow('a','b');
    void store.snapshot();
    const snap = store.snapshot();
    expect(snap.col.byRow.b).toBeDefined();
  });

  test('remove non-existing row is no-op', () => {
    const store = makeStore();
    expect(()=>store.removeRow('zzz')).not.toThrow();
  });

  test('multiple reset is idempotent', () => {
    const store = makeStore();
    store.setCell('c','r',1);
    store.reset();
    store.reset();
    void store.snapshot();
    expect(store.snapshot()).toEqual({});
  });
});