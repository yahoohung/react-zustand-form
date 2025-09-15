/**
 * Full coverage tests for src/core/version-map.ts
 */
import { createVersionMap } from '../src/core/version-map';

describe('createVersionMap', () => {
    it('ensures columns are created lazily', () => {
        const vm = createVersionMap();
        // column does not exist until accessed
        expect(Object.keys(vm.snapshot())).toHaveLength(0);
        vm.ensureColumn('c1');
        expect(Object.keys(vm.snapshot())).toEqual(['c1']);
    });

    it('bump increases column version and per-row counter', () => {
        const vm = createVersionMap();
        vm.bump('c1', null);            // bump column only
        let snap = vm.snapshot();
        expect(snap.c1.version).toBe(1);
        expect(snap.c1.versionByRow).toEqual({});

        vm.bump('c1', 'r1');             // bump column + specific row
        snap = vm.snapshot();
        expect(snap.c1.version).toBe(2);
        expect(snap.c1.versionByRow.r1).toBe(1);

        vm.bump('c1', 'r1');             // bump same row again
        snap = vm.snapshot();
        expect(snap.c1.version).toBe(3);
        expect(snap.c1.versionByRow.r1).toBe(2);

        vm.bump('c1', '');               // empty string rowKey is valid
        snap = vm.snapshot();
        expect(snap.c1.version).toBe(4);
        expect(snap.c1.versionByRow['']).toBe(1);
    });

    it('get creates column if missing and returns live reference', () => {
        const vm = createVersionMap();
        const live = vm.get('newCol');
        expect(live.version).toBe(0);
        // Mutating through live reference is reflected in snapshot
        live.version = 42;
        expect(vm.snapshot().newCol.version).toBe(42);
    });

    it('snapshot returns a deep copy', () => {
        const vm = createVersionMap();
        vm.bump('c1', 'r1');
        const snap1 = vm.snapshot();
        snap1.c1.version = 999;
        snap1.c1.versionByRow.r1 = 999;
        const snap2 = vm.snapshot();
        // Mutations to the snapshot must not leak back
        expect(snap2.c1.version).toBe(1);
        expect(snap2.c1.versionByRow.r1).toBe(1);
    });

    it('reset clears all stored versions', () => {
        const vm = createVersionMap();
        vm.bump('c1', 'r1');
        expect(Object.keys(vm.snapshot())).toContain('c1');
        vm.reset();
        expect(Object.keys(vm.snapshot())).toHaveLength(0);
        // bump after reset starts from 1 again
        vm.bump('c1', null);
        expect(vm.snapshot().c1.version).toBe(1);
    });
});