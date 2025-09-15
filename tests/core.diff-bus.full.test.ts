/**
 * Full coverage tests for src/core/diff-bus.ts
 * Exercises all dispatch strategies and edge cases.
 */
import { createDiffBus, DispatchStrategy, FieldDiff } from '../src/core/diff-bus';

function makeDiff(kind: 'insert' | 'update' | 'remove' | 'rename'): FieldDiff {
    if (kind === 'rename') {
        return { kind, path: 'rows.r.a', prev: 'old', next: 'new' };
    }
    if (kind === 'remove') {
        return { kind, path: 'rows.r.a', prev: 1 };
    }
    if (kind === 'update') {
        return { kind, path: 'rows.r.a', prev: 1, next: 2 };
    }
    return { kind, path: 'rows.r.a', next: 1 };
}

describe('createDiffBus', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });
    afterEach(() => {
        jest.useRealTimers();
    });

    const strategies: DispatchStrategy[] = ['microtask', 'animationFrame', 'idle'];

    it('publishes single and batched diffs and unsubscribes correctly', async () => {
        jest.useRealTimers();   
        const bus = createDiffBus('microtask');
        const seen: FieldDiff[][] = [];
        const unsubscribe = bus.subscribe(batch => seen.push(batch));

        // single diff
        bus.publish(makeDiff('insert'));
        // batch
        bus.publish([makeDiff('update'), makeDiff('remove')]);
        // empty array should be ignored
        bus.publish([]);

        // flush microtask queue – bus batches all diffs into a single flush
        await Promise.resolve();
        expect(seen.length).toBe(1);
        expect(seen[0].map(d => d.kind).sort()).toEqual(['insert', 'remove', 'update']);

        // unsubscribe stops further delivery
        unsubscribe();
        bus.publish(makeDiff('insert'));
        await Promise.resolve();
        expect(seen.length).toBe(1);
    });

    it('respects setStrategy/getStrategy and switches strategies at runtime', () => {
        const bus = createDiffBus();
        expect(typeof bus.getStrategy()).toBe('string');
        strategies.forEach(s => {
            bus.setStrategy(s);
            expect(bus.getStrategy()).toBe(s);
        });
    });

    it('flushes with setTimeout fallback when no animationFrame/idle/microtask', () => {
        // Temporarily remove globals to force macrotask path
        const raf = (globalThis as any).requestAnimationFrame;
        const idle = (globalThis as any).requestIdleCallback;
        (globalThis as any).requestAnimationFrame = undefined;
        (globalThis as any).requestIdleCallback = undefined;

        const bus = createDiffBus('animationFrame');
        const seen: FieldDiff[][] = [];
        bus.subscribe(batch => seen.push(batch));
        bus.publish(makeDiff('insert'));
        // flush via timers
        jest.runAllTimers();
        expect(seen.length).toBe(1);
        expect(seen[0][0].kind).toBe('insert');

        // restore globals
        (globalThis as any).requestAnimationFrame = raf;
        (globalThis as any).requestIdleCallback = idle;
    });

    it('handles animationFrame and idle strategies when available', () => {
        const calls: string[] = [];
        (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
            calls.push('raf');
            cb(0);
            return 1;
        };
        (globalThis as any).requestIdleCallback = (cb: Function) => {
            calls.push('idle');
            cb();
            return 1;
        };

        const bus1 = createDiffBus('animationFrame');
        const bus2 = createDiffBus('idle');
        const seen: string[] = [];
        bus1.subscribe(b => seen.push(b[0].kind));
        bus2.subscribe(b => seen.push(b[0].kind));

        bus1.publish(makeDiff('insert'));
        bus2.publish(makeDiff('update'));
        expect(calls).toEqual(expect.arrayContaining(['raf', 'idle']));
        expect(seen.sort()).toEqual(['insert', 'update']);
    });

    it('continues flushing if a listener throws', async () => {
        jest.useRealTimers();   
        const bus = createDiffBus('microtask');
        const good: FieldDiff[][] = [];
        bus.subscribe(() => { throw new Error('listener error'); });
        bus.subscribe(batch => good.push(batch));
        bus.publish(makeDiff('insert'));
        await Promise.resolve();
        expect(good.length).toBe(1);
        expect(good[0][0].kind).toBe('insert');
    });
});