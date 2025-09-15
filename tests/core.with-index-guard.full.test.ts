/**
 * Full coverage tests for src/core/with-index-guard.ts
 */
import { withIndexGuard } from '../src/core/with-index-guard';
import type { ActionGate } from '../src/core/action-gate';
import type { IndexStore } from '../src/index/column-index-store';
import * as devAssert from '../src/core/dev-assert';

describe('withIndexGuard', () => {
    const dummyGate: ActionGate = {
        applyPatches: jest.fn(),
        updateField: jest.fn(),
        addRow: jest.fn(),
        removeRow: jest.fn(),
        renameRow: jest.fn(),
    };

    const state = { rows: { r1: { a: 1 } } };
    const getState = () => state;
    const indexStore: IndexStore = {} as any;

    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('returns the gate unchanged in production mode', () => {
        const prev = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        const wrapped = withIndexGuard(dummyGate, getState, indexStore);
        expect(wrapped).toBe(dummyGate);
        process.env.NODE_ENV = prev;
    });

    it('wraps all methods and triggers assertIndexes in development', async () => {
        const prev = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        const spy = jest.spyOn(devAssert, 'assertIndexes').mockImplementation(() => { });
        const wrapped = withIndexGuard(dummyGate, getState, indexStore);

        // Call each wrapped method and ensure both the original fn and assertIndexes run
        wrapped.applyPatches({});
        wrapped.updateField('rows.r1.a', 2);
        wrapped.addRow('r2', { b: 3 });
        wrapped.removeRow('r1');
        wrapped.renameRow('r2', 'r3');

        // Original gate functions are called immediately
        expect(dummyGate.applyPatches).toHaveBeenCalled();
        expect(dummyGate.updateField).toHaveBeenCalled();
        expect(dummyGate.addRow).toHaveBeenCalled();
        expect(dummyGate.removeRow).toHaveBeenCalled();
        expect(dummyGate.renameRow).toHaveBeenCalled();

        // assertIndexes is called asynchronously (microtask)
        await Promise.resolve();
        expect(spy).toHaveBeenCalledTimes(5);

        process.env.NODE_ENV = prev;
    });

    it('catches and suppresses errors from assertIndexes', async () => {
        const prev = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        jest.spyOn(devAssert, 'assertIndexes').mockImplementation(() => {
            throw new Error('index mismatch');
        });
        const wrapped = withIndexGuard(dummyGate, getState, indexStore);
        wrapped.addRow('rX', { y: 9 });

        await Promise.resolve();
        // Error is caught internally; test passes if no unhandled rejection
        expect(dummyGate.addRow).toHaveBeenCalled();

        process.env.NODE_ENV = prev;
    });
});