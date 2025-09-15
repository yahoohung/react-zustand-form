/**
 * Full coverage tests for src/core/tiered-subscriptions.ts
 */
import {
    subscribeCompute,
    subscribeUiByColumn,
    pullColumn,
} from '../src/core/tiered-subscriptions';
import type { DiffBus, FieldDiff } from '../src/core/diff-bus';
import type { VersionMap } from '../src/core/version-map';
import type { IndexStore } from '../src/index/column-index-store';

function makeFakeBus(): DiffBus {
    const listeners = new Set<(d: FieldDiff[]) => void>();
    return {
        subscribe(cb) {
            listeners.add(cb);
            return () => listeners.delete(cb);
        },
        publish(diff: FieldDiff | FieldDiff[]) {
            const arr = Array.isArray(diff) ? diff : [diff];
            listeners.forEach(l => l(arr));
        },
        setStrategy: () => { },
        getStrategy: () => 'microtask',
    };
}

function makeFakeVersionMap(initial: number, withRows = true): VersionMap {
    let version = initial;
    let versionByRow = withRows ? { r1: 1, r2: 2 } : {};
    return {
        get: ((col: string) =>
            col === 'c1' ? { version, versionByRow } : undefined) as any,
        bump: () => { },
        ensureColumn: () => { },
        snapshot: () => ({}),
        reset: () => { },
    };
}

function makeFakeIndexStore(): IndexStore {
    const cache: Record<string, { byRow: Record<string, unknown> }> = {};
    return {
        getColumn: (col: string) => {
            if (!cache[col]) {
                cache[col] = { byRow: { r1: `v-${col}`, r2: `w-${col}` } };
            }
            return cache[col];
        },
        reset: () => { },
        setCell: () => { },
        removeRow: () => { },
        renameRow: () => { },
        rebuildFromRows: () => { },
        snapshot: () => ({}),
    };
}

describe('tiered-subscriptions', () => {
    it('subscribeCompute relays diffs and supports unsubscribe', () => {
        const bus = makeFakeBus();
        const seen: FieldDiff[][] = [];
        const unsub = subscribeCompute(bus, d => seen.push(d));
        bus.publish({ kind: 'insert', path: 'rows.r1.a', next: 1 });
        expect(seen.length).toBe(1);
        unsub();
        bus.publish({ kind: 'update', path: 'rows.r1.a', prev: 1, next: 2 });
        expect(seen.length).toBe(1); // unsubscribed, no more updates
    });

    it('subscribeUiByColumn emits on initial change and on version updates', () => {
        const vm = makeFakeVersionMap(1);
        const ticks: any[] = [];
        const sub = subscribeUiByColumn(vm, 'c1', info => ticks.push(info));
        // first call: same version -> no emit
        sub.check();
        expect(ticks.length).toBe(0);
        // bump version in place to trigger emit
        (vm as any).get = () => ({ version: 2, versionByRow: { r1: 5 } });
        sub.check();
        expect(ticks.length).toBe(1);
        expect(ticks[0].version).toBe(2);
    });

    it('subscribeUiByColumn handles column removal and envelope reuse', () => {
        const vm = makeFakeVersionMap(1);
        const ticks: any[] = [];
        const sub = subscribeUiByColumn(vm, 'c1', info => ticks.push(info), {
            reuseEnvelope: true,
        });
        // trigger a version change to set prevVersion
        (vm as any).get = () => ({ version: 2, versionByRow: { r1: 3 } });
        sub.check();
        expect(ticks[0].version).toBe(2);
        // now simulate column removal -> emits version 0
        (vm as any).get = () => undefined;
        sub.check();
        expect(ticks[ticks.length - 1].version).toBe(0);
    });

    it('subscribeUiByColumn does not emit if version unchanged and column missing', () => {
        const vm = makeFakeVersionMap(0, false);
        const ticks: any[] = [];
        const sub = subscribeUiByColumn(vm, 'c1', info => ticks.push(info));
        // missing column and prevVersion is 0 -> no emit
        sub.check();
        expect(ticks.length).toBe(0);
    });

    it('pullColumn returns live reference from index store', () => {
        const store = makeFakeIndexStore();
        const ref = pullColumn(store, 'colX');
        expect(ref).toEqual({ r1: 'v-colX', r2: 'w-colX' });
        // verify it is a live reference by mutating underlying object
        const internal = store.getColumn('colX').byRow;
        internal.r3 = 'new';
        expect(ref.r3).toBe('new');
    });
});