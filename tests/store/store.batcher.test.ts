import { createBatcher } from '../../src'; // adjust path to your repo

describe('createBatcher – merge-by-key, cap oldest, microtask flush', () => {
    test('merges same key and keeps the last payload; flushes in microtask', async () => {
        const bat = createBatcher({ max: 1000, useTransition: false });
        const flushed: Array<[string, any]> = [];

        bat.push('k', 1, (k, p) => flushed.push([k, p]));
        bat.push('k', 2, (k, p) => flushed.push([k, p])); // should overwrite previous

        // microtask turn
        await Promise.resolve();
        expect(flushed).toEqual([['k', 2]]);
    });

    test('drops the oldest key when exceeding the max queue size', async () => {
        const bat = createBatcher({ max: 2, useTransition: false });
        const order: string[] = [];

        bat.push('a', { n: 1 }, (k) => order.push(k));
        bat.push('b', { n: 2 }, (k) => order.push(k));
        bat.push('c', { n: 3 }, (k) => order.push(k)); // 'a' should be evicted

        await Promise.resolve();
        expect(order).toEqual(['b', 'c']);
    });

    test('wraps flush with startTransition when available (still flushes)', async () => {
        const bat = createBatcher({ max: 10, useTransition: true });
        const flushed: string[] = [];

        // lightweight polyfill: run immediately
        const orig = (globalThis as any).startTransition;
        (globalThis as any).startTransition = (fn: () => void) => fn();

        bat.push('x', 1, (k) => flushed.push(k));
        await Promise.resolve();
        expect(flushed).toEqual(['x']);

        // restore
        (globalThis as any).startTransition = orig;
    });
});
