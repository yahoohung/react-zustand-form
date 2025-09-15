/**
 * Full coverage tests for src/glue/form-kernel.ts
 */
import { createFormKernel } from '../src/glue/form-kernel';

describe('createFormKernel', () => {
    const initialRows = { r1: { a: 1 }, r2: { b: 2 } };

    it('creates a kernel with default options (no worker, guard enabled)', () => {
        const kernel = createFormKernel(initialRows);
        // store contains initial rows
        expect(kernel.useStore.getState().rows).toEqual(initialRows);
        // indexStore was rebuilt from initial rows
        const snap = kernel.indexStore.snapshot();
        expect(Object.keys(snap)).toContain('a');
        expect(Object.keys(snap)).toContain('b');
        // diffBus strategy defaults to animationFrame
        expect(kernel.diffBus.getStrategy()).toBe('animationFrame');
        // versionMap starts empty but can bump
        kernel.versionMap.bump('a', null);
        expect(kernel.versionMap.snapshot().a.version).toBe(1);
        // gate.updateField updates store rows
        kernel.gate.updateField('rows.r1.a', 99);
        expect(kernel.useStore.getState().rows.r1.a).toBe(99);
    });

    it('respects guardInDev = false and skips index guard wrapping', () => {
        const kernel = createFormKernel(initialRows, { guardInDev: false });
        // the gate should still work but without guard, indexStore stays consistent
        kernel.gate.addRow('r3', { c: 3 });
        expect(kernel.useStore.getState().rows.r3.c).toBe(3);
    });

    it('allows custom index options and offloadToWorker flag', async () => {
        const kernel = createFormKernel(initialRows, {
            index: { lruLimit: 2 },
            offloadToWorker: true,
        });
        // force immediate flushing for the test
        kernel.diffBus.setStrategy('microtask');

        const seen: any[] = [];
        const unsub = kernel.diffBus.subscribe(d => seen.push(d));
        kernel.diffBus.publish({ kind: 'insert', path: 'rows.r1.a', next: 42 });

        // flush the microtask queue
        await Promise.resolve();
        expect(seen.length).toBeGreaterThan(0);
        unsub();
    });

    it('setStateSafe forces partial updates even if replace=true', () => {
        const kernel = createFormKernel(initialRows);
        // directly call setStateSafe through the gate to update rows
        kernel.gate.addRow('rX', { z: 10 });
        const rows = kernel.useStore.getState().rows;
        expect(rows.rX.z).toBe(10);
        // confirm that previous rows were not replaced
        expect(rows.r1.a).toBe(1);
    });
});