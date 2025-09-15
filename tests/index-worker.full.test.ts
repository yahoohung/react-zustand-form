/**
 * Full coverage tests for src/index/worker/index-worker.ts
 * Simulates the Web Worker environment by providing a fake `self`.
 */
describe('index-worker', () => {
    let messages: any[];
    let handler: ((ev: MessageEvent) => void) | null;
    let fakeStore: any;

    beforeEach(() => {
        messages = [];
        handler = null;
        fakeStore = {
            setCell: jest.fn(),
            removeRow: jest.fn(),
            renameRow: jest.fn(),
            rebuildFromRows: jest.fn(),
            reset: jest.fn(),
            snapshot: jest.fn(() => ({ snap: true })),
        };

        // Stub importScripts for Node environment
        (global as any).importScripts = () => {};

        // minimal worker global
        (global as any).self = {
            onmessage: null,
            postMessage: (msg: any) => messages.push(msg),
            __indexStoreImpl: jest.fn(() => fakeStore),
        };

        // import the worker script (it assigns self.onmessage)
        jest.isolateModules(() => {
            require('../src/index/worker/index-worker.ts');
        });

        handler = (global as any).self.onmessage;
        expect(typeof handler).toBe('function');
    });

    function send(data: any) {
        handler!({ data } as MessageEvent);
    }

    it('initialises the store on init and ignores messages before init', () => {
        // message before init is ignored
        send({ kind: 'setCell', col: 'c', rowKey: 'r', value: 1 });
        expect(fakeStore.setCell).not.toHaveBeenCalled();

        // initialise
        send({ kind: 'init', opts: { opt: 1 } });
        expect((global as any).self.__indexStoreImpl).toHaveBeenCalledWith({ opt: 1 });

        // subsequent calls use the fake store
        send({ kind: 'setCell', col: 'c', rowKey: 'r', value: 1 });
        expect(fakeStore.setCell).toHaveBeenCalledWith('c', 'r', 1);
    });

    it('dispatches all supported message kinds', () => {
        send({ kind: 'init', opts: {} });

        send({ kind: 'setCell', col: 'a', rowKey: 'x', value: 42 });
        send({ kind: 'removeRow', rowKey: 'x' });
        send({ kind: 'renameRow', oldKey: 'x', newKey: 'y' });
        send({ kind: 'rebuildFromRows', rows: { r1: { a: 1 } } });
        send({ kind: 'reset' });

        expect(fakeStore.setCell).toHaveBeenCalledWith('a', 'x', 42);
        expect(fakeStore.removeRow).toHaveBeenCalledWith('x');
        expect(fakeStore.renameRow).toHaveBeenCalledWith('x', 'y');
        expect(fakeStore.rebuildFromRows).toHaveBeenCalledWith({ r1: { a: 1 } });
        expect(fakeStore.reset).toHaveBeenCalled();
    });

    it('handles snapshot by posting back a reply', () => {
        send({ kind: 'init', opts: {} });
        send({ kind: 'snapshot', id: 99 });
        expect(fakeStore.snapshot).toHaveBeenCalled();
        expect(messages[0]).toEqual({ kind: 'snapshot', id: 99, data: { snap: true } });
    });
});