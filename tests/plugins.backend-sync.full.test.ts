/* eslint-env jest */
/**
 * Full coverage tests for src/plugins/backend-sync/index.ts
 * Use real timers to avoid fake-timer/microtask traps.
 */
import { createBackendSync } from '../src/plugins/backend-sync/index';
import type { FieldDiff, DiffBus, DispatchStrategy } from '../src/core/diff-bus';
import type { ActionGate } from '../src/core/action-gate';

function makeDeps() {
  const rows = { rows: { r1: { a: 1 } } };

  const gate: ActionGate = {
    applyPatches: jest.fn(),
    updateField: jest.fn(),
    addRow: jest.fn(),
    removeRow: jest.fn(),
    renameRow: jest.fn(),
  };

  const listeners = new Set<(d: FieldDiff[]) => void>();
  const diffBus: DiffBus = {
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    publish(diff: FieldDiff | FieldDiff[]) {
      const batch = Array.isArray(diff) ? diff : [diff];
      listeners.forEach((l) => l(batch));
    },
    setStrategy: () => {},
    getStrategy: () => 'animationFrame' as DispatchStrategy,
  };

  return {
    deps: { diffBus, gate, getState: () => rows },
    bus: diffBus,
    setRows(r: any) {
      rows.rows = r;
    },
  } as const;
}

describe('createBackendSync', () => {
  // Use real timers so setTimeout/backoff actually fires
  beforeAll(() => {
    jest.useRealTimers();
  });

  it('debounces and coalesces outgoing diffs; flush() pushes immediately; retry works', async () => {
    const pushed: FieldDiff[][] = [];
    const { deps, bus } = makeDeps();

    const sync = createBackendSync(deps, {
      push: async (b) => { pushed.push(b); },
      debounceMs: 20,
      coalesceSamePath: true,
      retry: { retries: 1, backoffMs: () => 10 },
      onPushStart: jest.fn(),
      onPushSuccess: jest.fn(),
      onPushError: jest.fn(),
    });

    sync.start();

    // Two diffs on the same path → should coalesce to the last one
    bus.publish([
      { kind: 'insert', path: 'rows.r1.a', next: 1 },
      { kind: 'insert', path: 'rows.r1.a', next: 2 },
    ]);

    // wait > debounce
    await new Promise((r) => setTimeout(r, 35));
    expect(pushed.length).toBe(1);
    expect(pushed[0]).toHaveLength(1);
    expect(pushed[0][0]).toMatchObject({ kind: 'insert', path: 'rows.r1.a', next: 2 });

    // Another diff then manual flush should push immediately (no debounce wait)
    bus.publish({ kind: 'insert', path: 'rows.r1.b', next: 3 });
    await sync.flush();
    expect(pushed.length).toBe(2);

    // Retry path: first attempt throws, second succeeds
    const pushedRetry: FieldDiff[][] = [];
    let failOnce = true;
    const syncRetry = createBackendSync(deps, {
      push: async (b) => {
        pushedRetry.push(b);
        if (failOnce) { failOnce = false; throw new Error('boom'); }
      },
      debounceMs: 10,
      retry: { retries: 1, backoffMs: () => 5 },
    });

    syncRetry.start();
    bus.publish({ kind: 'insert', path: 'rows.r1.c', next: 9 });
    // wait enough for debounce + retry backoff
    await new Promise((r) => setTimeout(r, 40));
    expect(pushedRetry.length).toBeGreaterThanOrEqual(2); // initial + retry
  });

  it('pushes immediately when debounceMs <= 0', async () => {
    const pushed: FieldDiff[][] = [];
    const { deps, bus } = makeDeps();

    const sync = createBackendSync(deps, { push: async (b) => { pushed.push(b); }, debounceMs: 0 });
    sync.start();
    bus.publish({ kind: 'insert', path: 'rows.r1.a', next: 5 });

    // allow microtask to settle
    await new Promise((r) => setTimeout(r, 0));
    expect(pushed.length).toBe(1);
  });

  it('filters out server-sourced diffs before scheduling', async () => {
    const pushed: FieldDiff[][] = [];
    const { deps, bus } = makeDeps();

    const sync = createBackendSync(deps, { push: async (b) => { pushed.push(b); }, debounceMs: 0 });
    sync.start();

    bus.publish({ kind: 'insert', path: 'rows.r1.a', next: 1, source: 'server' } as any);
    await new Promise((r) => setTimeout(r, 0));
    expect(pushed.length).toBe(0);
  });

  it('applyServerPatch honours keepDirtyValues policy', () => {
    const { deps, setRows } = makeDeps();

    const sync = createBackendSync(deps, {
      push: async () => {},
      keepDirtyValues: { shouldKeep: (_p, local, server) => local === 2 && server === 1 },
    });

    // local=1, server=1 -> shouldKeep=false -> patch applied
    sync.applyServerPatch({ patches: { 'rows.r1.a': 1 } });
    expect(deps.gate.applyPatches).toHaveBeenCalledWith({ 'rows.r1.a': 1 });

    // local=2, server=1 -> shouldKeep=true -> no patch
    setRows({ r1: { a: 2 } });
    sync.applyServerPatch({ patches: { 'rows.r1.a': 1 } });
    expect((deps.gate.applyPatches as jest.Mock).mock.calls.length).toBe(1);
  });

  it('stop prevents scheduled pushes; dispose clears pending and cancels', async () => {
    const pushed: FieldDiff[][] = [];
    const { deps, bus } = makeDeps();
    const sync = createBackendSync(deps, { push: async (b) => { pushed.push(b); }, debounceMs: 50 });

    sync.start();
    bus.publish({ kind: 'insert', path: 'rows.r1.a', next: 1 });
    sync.stop();
    await new Promise((r) => setTimeout(r, 60));
    expect(pushed.length).toBe(0);

    // queue another then dispose before it can run; flush should be a no-op
    bus.publish({ kind: 'insert', path: 'rows.r1.a', next: 2 });
    sync.dispose();
    await sync.flush();
    expect(pushed.length).toBe(0);
  });
});