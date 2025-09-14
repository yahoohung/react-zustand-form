import { createIndexStoreWorker } from '../src/index/index-store.worker';

describe('IndexStore import.meta fallback', () => {
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
    test('works when __WORKER_BASE_URL__ is undefined', () => {
        const prev = (globalThis as any).__WORKER_BASE_URL__;
        delete (globalThis as any).__WORKER_BASE_URL__;

        const store = createIndexStoreWorker({});
        const worker = (globalThis as any).__lastWorker;
        worker.__indexStoreImpl = (_o: unknown) => (globalThis as any).__createInMemoryIndexStore();

        store.setCell('col', 'row', 42);
        void store.snapshot();
        expect(store.snapshot().col.byRow.row).toBe(42);

        // restore
        (globalThis as any).__WORKER_BASE_URL__ = prev;
    });
});