import { createFormStore } from '../../src/core/store'; // adjust path if needed

describe('createFormStore – core API (node env, no React)', () => {
    test('initial state is correctly seeded', () => {
        const init = { a: 1, user: { name: 'Ada' } };
        const store = createFormStore('test', init, /*devtools*/ false);

        const s = store.getState();
        expect(s.name).toBe('test');
        expect(s.__initial).toEqual(init);
        expect(s.formState).toEqual({
            dirtyFields: {},
            touchedFields: {},
            errors: {},
        });
        // serverState is optional/undefined until used
        expect('serverState' in s ? s.serverState : undefined).toBeUndefined();
    });

    test('setState updates and notifies subscribers; unsubscribe stops notifications', () => {
        const store = createFormStore('t', { a: 1 }, false);
        const seen: Array<Record<string, any>> = [];

        const unsub = store.subscribe((s) => seen.push(s.formState));
        expect(seen.length).toBe(0);

        // mark a as dirty
        store.setState(
            (s) => ({
                ...s,
                formState: {
                    ...s.formState,
                    dirtyFields: { ...s.formState.dirtyFields, a: true },
                },
            }),
            false,
            { type: 't field:dirty' } // action label should not throw in non-devtools mode
        );

        expect(store.getState().formState.dirtyFields.a).toBe(true);
        expect(seen.length).toBe(1);
        expect(seen[0].dirtyFields.a).toBe(true);

        // after unsubscribe, further updates do not push into seen[]
        unsub();
        store.setState(
            (s) => ({
                ...s,
                formState: {
                    ...s.formState,
                    touchedFields: { ...s.formState.touchedFields, a: true },
                },
            }),
            false,
            { type: 't field:touched' }
        );
        expect(store.getState().formState.touchedFields.a).toBe(true);
        expect(seen.length).toBe(1); // unchanged after unsubscribe
    });

    test('multiple updates keep unrelated branches by reference (shallow sanity)', () => {
        const store = createFormStore('t', { a: 1 }, false);
        const before = store.getState();

        store.setState(
            (s) => ({
                ...s,
                formState: {
                    ...s.formState,
                    errors: { ...s.formState.errors, a: 'err' },
                },
            }),
            false,
            { type: 't error:set' }
        );

        const after = store.getState();
        // state object is replaced
        expect(after).not.toBe(before);
        // unrelated maps are separate objects but previous references should not be mutated
        expect(before.formState.errors).toEqual({});
        expect(after.formState.errors).toEqual({ a: 'err' });
    });

    test('stores are isolated (no cross-talk between instances)', () => {
        const s1 = createFormStore('s1', { v: 0 }, false);
        const s2 = createFormStore('s2', { v: 0 }, false);

        s1.setState(
            (s) => ({
                ...s,
                formState: {
                    ...s.formState,
                    dirtyFields: { ...s.formState.dirtyFields, x: true },
                },
            }),
            false,
            { type: 's1 dirty' }
        );

        expect(s1.getState().formState.dirtyFields.x).toBe(true);
        expect(s2.getState().formState.dirtyFields.x).toBeUndefined();
    });
});
