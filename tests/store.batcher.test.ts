import { createBatcher } from '../src';

describe('batcher', () => {
    test('merges by key and flushes in microtask', async () => {
        const bat = createBatcher({ max: 1000, useTransition: false });
        const flushed: Array<[string, any]> = [];
        bat.push('k', 1, (k, p) => flushed.push([k, p]));
        bat.push('k', 2, (k, p) => flushed.push([k, p])); // merged -> keep last
        await Promise.resolve(); // flush microtask
        expect(flushed).toEqual([['k', 2]]);
    });

    test('drops oldest when exceeding max keys', async () => {
        const bat = createBatcher({ max: 2 });
        const flushed: string[] = [];
        bat.push('a', 1, (k) => flushed.push(k));
        bat.push('b', 1, (k) => flushed.push(k));
        bat.push('c', 1, (k) => flushed.push(k)); // 'a' should be dropped
        await Promise.resolve();
        // order of flush follows surviving keys in insertion order
        expect(flushed).toEqual(['b', 'c']);
    });
});
