import { createFormStore } from '../../src/core/store';

test('devtools middleware is not attached in production; setState still works', () => {
    const OLD = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const store = createFormStore('t', { a: 1 }, /*devtools*/ true);
    // should not throw when passing action labels
    expect(() =>
        store.setState(
            (s) => ({
                ...s,
                formState: {
                    ...s.formState,
                    dirtyFields: { ...s.formState.dirtyFields, a: true },
                },
            }),
            false,
            { type: 't field:dirty' }
        )
    ).not.toThrow();

    expect(store.getState().formState.dirtyFields.a).toBe(true);
    process.env.NODE_ENV = OLD;
});
