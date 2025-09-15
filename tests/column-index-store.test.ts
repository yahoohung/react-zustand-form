/**
 * Extra LRU tests for column-index-store.
 * Simple UK English. No `for..of`.
 */
import { createIndexStore } from '../src/index/column-index-store';

describe('column-index-store LRU behaviour', () => {
  test('touch via getColumn affects eviction order', () => {
    const store = createIndexStore({ lru: { maxColumns: 2 } });
    store.setCell('c1', 'r', 1);
    store.setCell('c2', 'r', 2);
    // Access c1 so it becomes most recently used
    void store.getColumn('c1');
    // Insert c3 -> should evict the oldest (c2)
    store.setCell('c3', 'r', 3);

    expect(store.getColumn('c1').byRow).toEqual({ r: 1 });
    expect(store.getColumn('c2').byRow).toEqual({});
    expect(store.getColumn('c3').byRow).toEqual({ r: 3 });
  });

  test('limit <= 0 keeps at most one column', () => {
    const store = createIndexStore({ lru: { maxColumns: 0 } });
    store.setCell('a', 'r', 1);
    store.setCell('b', 'r', 2); // prune to 1
    store.setCell('c', 'r', 3); // still only 1 kept

    const snap = store.snapshot();
    const keys = Object.keys(snap);
    expect(keys.length).toBe(1);
    const only = keys[0];
    expect(store.getColumn(only).byRow).toEqual({ r: (snap[only].byRow as any).r });
  });

  test('whitelist with LRU indexes only allowed columns', () => {
    const store = createIndexStore({ whitelistColumns: ['x', 'y'], lru: { maxColumns: 1 } });
    store.setCell('x', 'r1', 1);
    store.setCell('z', 'r1', 9); // ignored by whitelist
    // Add another allowed column; should prune to 1, dropping the oldest (x)
    store.setCell('y', 'r1', 2);

    expect(store.getColumn('z').byRow).toEqual({});
    // After prune to 1, only the most recent allowed column remains
    expect(Object.keys(store.snapshot())).toEqual(['y']);
    expect(store.getColumn('y').byRow).toEqual({ r1: 2 });
  });

  test('getColumn on disallowed column returns empty (no index created)', () => {
    const s = createIndexStore({ whitelistColumns: ['ok'] });
    expect(s.getColumn('nope').byRow).toEqual({});
    // snapshot should not contain 'nope'
    expect(Object.keys(s.snapshot())).toEqual([]);
  });

  test('rebuildFromRows eagerly builds allowed columns then prunes once', () => {
    const s = createIndexStore({ whitelistColumns: ['a','b','c'], lru: { maxColumns: 2 } });
    s.rebuildFromRows({ r1: { a: 1, b: 2, c: 3 } });
    const keys = Object.keys(s.snapshot());
    expect(keys.length).toBe(2);            // pruned to limit
    expect(keys).toEqual(expect.arrayContaining(['b','c'])); // 'a' is oldest
  });

  test('reset clears everything including index map', () => {
    const s = createIndexStore();
    s.setCell('x','r',1);
    s.setCell('y','r',2);
    s.reset();
    expect(Object.keys(s.snapshot())).toEqual([]);
    expect(s.getColumn('x').byRow).toEqual({}); // fresh/empty
  });

  test('removeRow and renameRow interplay leaves no stale keys', () => {
    const s = createIndexStore();
    s.setCell('col','a',1);
    s.renameRow('a','b');
    s.removeRow('b');
    expect(s.getColumn('col').byRow).toEqual({});
  });  
});