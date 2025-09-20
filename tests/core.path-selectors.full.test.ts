/**
 * Full-coverage tests for src/core/path-selectors.ts
 */
import { makeFieldSelector, selectorCache } from '../src/core/path-selectors';

type State = { rows: Record<string, Record<string, unknown>> };

describe('path-selectors', () => {
    beforeEach(() => {
        selectorCache.clear();
    });

    it('makeFieldSelector caches and returns the same selector', () => {
        const state: State = { rows: { r1: { a: 1 } } };
        const sel1 = makeFieldSelector<State>('r1', 'a');
        const sel2 = makeFieldSelector<State>('r1', 'a');
        expect(sel1).toBe(sel2); // same reference from cache
        expect(sel1(state)).toBe(1);
    });

    it('selector safely returns undefined for missing rows/columns', () => {
        const sel = makeFieldSelector<State>('missing', 'x');
        // @ts-expect-error intentionally passing wrong shape
        expect(sel({})).toBeUndefined();
        expect(sel({ rows: {} })).toBeUndefined();
    });

    it('dropRowFromSelectorCache removes only selectors for the target row', () => {
        const s1 = makeFieldSelector<State>('r1', 'a');
        const s2 = makeFieldSelector<State>('r2', 'b');
        selectorCache.dropRow('r1');
        const s1b = makeFieldSelector<State>('r1', 'a');
        const s2b = makeFieldSelector<State>('r2', 'b');
        // r1 selector was dropped, new reference created
        expect(s1b).not.toBe(s1);
        // r2 selector remains cached
        expect(s2b).toBe(s2);
    });

    it('renameRowInSelectorCache moves selectors and merges with existing row map', () => {
        const selOldA = makeFieldSelector<State>('old', 'a');
        const selOldB = makeFieldSelector<State>('old', 'b');
        const selNewExisting = makeFieldSelector<State>('new', 'x');
        selectorCache.renameRow('old', 'new');
        const selNewA = makeFieldSelector<State>('new', 'a');
        const selNewB = makeFieldSelector<State>('new', 'b');
        expect(selNewA).toBe(selOldA);
        expect(selNewB).toBe(selOldB);
        // Existing selectors under the target row remain intact
        const selNewExisting2 = makeFieldSelector<State>('new', 'x');
        expect(selNewExisting2).toBe(selNewExisting);
        // Old row should have been removed
        const selOldA2 = makeFieldSelector<State>('old', 'a');
        expect(selOldA2).not.toBe(selOldA);
    });

    it('selectorCache.clear empties all selectors', () => {
        const s1 = makeFieldSelector<State>('r1', 'a');
        const s2 = makeFieldSelector<State>('r2', 'b');
        selectorCache.clear();
        const s1b = makeFieldSelector<State>('r1', 'a');
        const s2b = makeFieldSelector<State>('r2', 'b');
        // after clearing, new references are returned
        expect(s1b).not.toBe(s1);
        expect(s2b).not.toBe(s2);
    });
});
