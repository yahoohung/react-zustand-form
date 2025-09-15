/**
 * Full coverage tests for core/dev-assert.ts
 */
import { assertIndexes, rebuildIndexes } from '../src/core/dev-assert';
import type { IndexStore } from '../src/index/column-index-store';

function makeIndexStore(initial: Record<string, Record<string, unknown>>): IndexStore {
  let snapshotData: Record<string, { byRow: Record<string, unknown> }> = {};
  Object.entries(initial).forEach(([col, rows]) => {
    snapshotData[col] = { byRow: { ...rows } };
  });

  return {
    snapshot: () => snapshotData,
    rebuildFromRows: (rows: Record<string, any>) => {
      snapshotData = {};
      Object.entries(rows).forEach(([rk, row]) => {
        if (row && typeof row === 'object') {
          Object.entries(row).forEach(([ck, v]) => {
            snapshotData[ck] ??= { byRow: {} };
            snapshotData[ck].byRow[rk] = v;
          });
        }
      });
    },
    // the following methods are required by IndexStore but are unused in dev-assert
    setCell: () => {},
    removeRow: () => {},
    renameRow: () => {},
  } as unknown as IndexStore;
}

describe('dev-assert', () => {
  it('passes when indexes match', () => {
    const rows = { r1: { a: 1, b: 2 }, r2: { a: 3 } };
    const store = makeIndexStore({
      a: { r1: 1, r2: 3 },
      b: { r1: 2 },
    });
    expect(() => assertIndexes(rows, store)).not.toThrow();
  });

  it('throws and logs when index is missing a row', () => {
    const rows = { r1: { a: 1 } };
    const store = makeIndexStore({ a: {} });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => assertIndexes(rows, store)).toThrow(/missing row/);
    spy.mockRestore();
  });

  it('throws when index has an extra row', () => {
    const rows = { r1: { a: 1 } };
    const store = makeIndexStore({ a: { r1: 1, r2: 2 } });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => assertIndexes(rows, store)).toThrow(/extra row/);
    spy.mockRestore();
  });

  it('throws when index value mismatches', () => {
    const rows = { r1: { a: 1 } };
    const store = makeIndexStore({ a: { r1: 99 } });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => assertIndexes(rows, store)).toThrow(/value mismatch/);
    spy.mockRestore();
  });

  it('rebuildIndexes regenerates correct snapshot', () => {
    const rows = { r1: { a: 1, b: 2 }, r2: { a: 3 } };
    const store = makeIndexStore({});
    rebuildIndexes(rows, store);
    const snap = store.snapshot();
    expect(snap.a.byRow).toEqual({ r1: 1, r2: 3 });
    expect(snap.b.byRow).toEqual({ r1: 2 });
  });
});