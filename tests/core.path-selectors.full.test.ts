/**
 * Full-coverage tests for src/core/path-selectors.ts
 */
import {
    makeFieldSelector,
    dropRowFromSelectorCache,
    renameRowInSelectorCache,
    clearSelectorCache,
} from '../src/core/path-selectors';

type State = { rows: Record<string, Record<string, unknown>> };

describe('path-selectors', () => {
    beforeEach(() => {
        clearSelectorCache();
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

    it('dropRowFromSelectorCache removes only selectors with matching prefix', () => {
        const s1 = makeFieldSelector<State>('r1', 'a');
        const s2 = makeFieldSelector<State>('r2', 'b');
        dropRowFromSelectorCache('r1');
        const s1b = makeFieldSelector<State>('r1', 'a');
        const s2b = makeFieldSelector<State>('r2', 'b');
        // r1 selector was dropped, new reference created
        expect(s1b).not.toBe(s1);
        // r2 selector remains cached
        expect(s2b).toBe(s2);
    });

    it('renameRowInSelectorCache moves selectors to new row key', () => {
        const selOldA = makeFieldSelector<State>('old', 'a');
        const selOldB = makeFieldSelector<State>('old', 'b');
        renameRowInSelectorCache('old', 'new');
        const selNewA = makeFieldSelector<State>('new', 'a');
        const selNewB = makeFieldSelector<State>('new', 'b');
        // renamed selectors are the same functions
        expect(selNewA).toBe(selOldA);
        expect(selNewB).toBe(selOldB);
        // old keys should now be replaced with new keys
        dropRowFromSelectorCache('old'); // should do nothing
        const selNewA2 = makeFieldSelector<State>('new', 'a');
        expect(selNewA2).toBe(selNewA);
    });

    it('clearSelectorCache empties all selectors', () => {
        const s1 = makeFieldSelector<State>('r1', 'a');
        const s2 = makeFieldSelector<State>('r2', 'b');
        clearSelectorCache();
        const s1b = makeFieldSelector<State>('r1', 'a');
        const s2b = makeFieldSelector<State>('r2', 'b');
        // after clearing, new references are returned
        expect(s1b).not.toBe(s1);
        expect(s2b).not.toBe(s2);
    });
});