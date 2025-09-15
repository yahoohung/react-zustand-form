import { createIndexStoreWorker } from '../src/index/index-store.worker';

describe('IndexStore protocol', () => {
  test('proxy sends correct message payloads', () => {
    const sent: any[] = [];
    // Patch Worker to spy messages
    const Orig = global.Worker;
    (global as any).Worker = class {
      onmessage: ((e: MessageEvent) => void) | null = null;
      postMessage(msg: any) { sent.push(msg); }
      terminate() {}
    } as any;

    const store = createIndexStoreWorker({});
    store.setCell('c','r','v');
    store.removeRow('r');
    store.renameRow('r','x');
    void store.snapshot();

    expect(sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'setCell' }),
        expect.objectContaining({ kind: 'removeRow' }),
        expect.objectContaining({ kind: 'renameRow' }),
        expect.objectContaining({ kind: 'snapshot' })
      ])
    );

    (global as any).Worker = Orig;
  });
});