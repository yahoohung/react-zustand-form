/* eslint-disable */
/* eslint-env jest */
import { createActionGate } from '../src/core/action-gate';
import type { FieldDiff } from '../src/core/diff-bus';

// simple fakes for deps
function makeDeps() {
  let state = { rows: {} as Record<string, Record<string, unknown>> };
  const diffs: FieldDiff[][] = [];
  const bumps: Array<[string, string]> = [];
  const indexOps: Array<[string, string, unknown]> = [];
  return {
    getState: () => state,
    setState: (partial: Partial<typeof state>, _replace?: boolean, _actionName?: string) => {
      state = { ...state, ...partial };
    },
    diffBus: {
      publish: (diff: FieldDiff | FieldDiff[]) => {
        const arr = Array.isArray(diff) ? diff : [diff];
        diffs.push(arr);
      },
      subscribe: () => () => { /* no-op unsubscribe */ },
      setStrategy: () => { /* no-op */ },
      // Adjusted to satisfy DispatchStrategy type (commonly 'immediate' | 'queued')
      getStrategy: () => 'immediate' as unknown as import('../src/core/diff-bus').DispatchStrategy,
    },
    versionMap: {
      bump: (col: string, rowKey: string | null) => {
        bumps.push([col, rowKey ?? '']);
      },
      ensureColumn: () => { /* no-op */ },
      dropRow: () => { /* no-op */ },
      renameRow: () => { /* no-op */ },
      get: () => ({ version: 0 }),
      snapshot: () => ({}),
      reset: () => { /* no-op */ },
    },
    indexStore: {
      setCell: (col: string, row: string, val: unknown) => indexOps.push([col, row, val]),
      removeRow: (row: string) => indexOps.push(['removeRow', row, undefined]),
      renameRow: (oldKey: string, newKey: string) =>
        indexOps.push(['renameRow', `${oldKey}->${newKey}`, undefined]),
    },
    logs: { diffs, bumps, indexOps, get rows() { return state.rows; } },
  };
}

describe('createActionGate', () => {
  it('splitPath guards against bad keys', () => {
    const deps = makeDeps();
    const g = createActionGate(deps);
    // invalid paths: missing prefix, dangerous key, empty column
    g.updateField('foo.bar', 1);
    g.updateField('rows.__proto__.x', 1);
    g.updateField('rows.row.', 1);
    expect(Object.keys(deps.logs.rows)).toHaveLength(0);
  });

  it('addRow inserts and publishes diffs, skips duplicate key', () => {
    const deps = makeDeps();
    const g = createActionGate(deps);
    g.addRow('r1', { a: 1, b: 2 });
    expect(deps.logs.rows.r1).toEqual({ a: 1, b: 2 });
    // duplicate add is no-op
    g.addRow('r1', { a: 99 });
    expect(deps.logs.rows.r1).toEqual({ a: 1, b: 2 });
    expect(deps.logs.diffs[0]).toHaveLength(2); // two insert diffs
  });

  it('updateField inserts then updates, skips no-op', () => {
    const deps = makeDeps();
    const g = createActionGate(deps);
    g.updateField('rows.r1.c1', 1); // insert
    g.updateField('rows.r1.c1', 2); // update
    g.updateField('rows.r1.c1', 2); // no-op
    expect(deps.logs.rows.r1.c1).toBe(2);
    const kinds = deps.logs.diffs.flat().map(d => d.kind);
    expect(kinds).toContain('insert');
    expect(kinds).toContain('update');
  });

  it('removeRow publishes remove diffs and clears index', () => {
    const deps = makeDeps();
    const g = createActionGate(deps);
    g.addRow('r2', { x: 10, y: 20 });
    g.removeRow('r2');
    // second call is no-op
    g.removeRow('r2');
    expect(deps.logs.rows.r2).toBeUndefined();
    const kinds = deps.logs.diffs.flat().map(d => d.kind);
    expect(kinds).toContain('remove');
    expect(deps.logs.indexOps.some(([op]) => op === 'removeRow')).toBe(true);
  });

  it('renameRow moves data and publishes rename diffs', () => {
    const deps = makeDeps();
    const g = createActionGate(deps);
    g.addRow('old', { a: 1 });
    g.renameRow('old', 'new');
    // rename to same key → no-op
    g.renameRow('new', 'new');
    // rename with missing key → no-op
    g.renameRow('missing', 'x');
    // rename to existing key → no-op
    g.addRow('block', { a: 1 });
    g.renameRow('new', 'block');
    expect(deps.logs.rows.new).toEqual({ a: 1 });
    const kinds = deps.logs.diffs.flat().map(d => d.kind);
    expect(kinds).toContain('rename');
    expect(deps.logs.indexOps.some(([op]) => op === 'renameRow')).toBe(true);
  });

  it('applyPatches inserts, updates and rebases when state changes', () => {
    const deps = makeDeps();
    // seed an initial value so that patch 'a' performs an update instead of insert
    deps.setState({ rows: { rows1: { a: 0 } } });
    const g = createActionGate(deps);
    // prepare concurrent change by monkey patching getState
    let count = 0;
    const orig = deps.getState;
    deps.getState = () => {
      count++;
      if (count === 2) {
        // simulate concurrent update
        deps.setState({ rows: { rows1: { a: 42 } } });
      }
      return orig();
    };
    const patch = {
      'rows.rows1.a': 1,
      'rows.rows1.b': 2,
      'invalid.path': 3, // ignored
    };
    g.applyPatches(patch);
    // after rebase, rows1 should contain at least our new values
    expect(deps.logs.rows.rows1.a).toBe(1);
    expect(deps.logs.rows.rows1.b).toBe(2);
    const kinds = deps.logs.diffs.flat().map(d => d.kind);
    expect(kinds).toContain('insert');
    expect(kinds).toContain('update');
  });
});
