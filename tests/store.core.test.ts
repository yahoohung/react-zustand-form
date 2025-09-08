import { createFormStore } from '../src';

describe('store core', () => {
    test('getState/setState/subscribe', () => {
        const store = createFormStore('t', { a: 1 }, false);
        const seen: any[] = [];
        const unsub = store.subscribe(s => seen.push(s.formState));
        // update dirtyFields
        store.setState(s => ({
            ...s,
            formState: { ...s.formState, dirtyFields: { ...s.formState.dirtyFields, 'a': true } }
        }), false, { type: 'test:dirty' });

        expect(store.getState().formState.dirtyFields.a).toBe(true);
        expect(seen.length).toBeGreaterThan(0);
        unsub();
        const cnt = seen.length;
        // further updates do not trigger after unsubscribe
        store.setState(s => ({ ...s }), false, { type: 'noop' });
        expect(seen.length).toBe(cnt);
    });
});
