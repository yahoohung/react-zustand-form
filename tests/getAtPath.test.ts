import { getAtPath } from '../src'; 

describe('getAtPath – comprehensive but minimal suite', () => {
    test('reads nested via dot + bracket (happy path)', () => {
        const obj = {
            user: { profile: { name: 'Ada' } },
            items: [{ qty: 3 }, { qty: 5 }],
            map: { '0': 'zero' },
        };
        expect(getAtPath(obj, 'user.profile.name')).toBe('Ada');
        expect(getAtPath(obj, 'items[1].qty')).toBe(5);
        expect(getAtPath(obj, 'items.0.qty')).toBe(3);   // dot + numeric key
        expect(getAtPath(obj, 'map.0')).toBe('zero');    // object key "0"
    });

    test('supports array path input (including keys with dots)', () => {
        const obj = { a: { 'x.y': 1 }, arr: [{ val: 42 }] };
        expect(getAtPath(obj, ['a', 'x.y'])).toBe(1);       // dot in key handled by array path
        expect(getAtPath(obj, ['arr', 0, 'val'])).toBe(42);
        expect(getAtPath(obj, ['arr', -1])).toBeUndefined(); // negative index by design -> undefined
    });

    test('returns undefined for missing segments or null intermediates', () => {
        const obj1: any = { a: null };
        const obj2: any = {};
        expect(getAtPath(obj1, 'a.b.c')).toBeUndefined(); // stop at null
        expect(getAtPath(obj2, 'not.exist')).toBeUndefined();
        expect(getAtPath({ arr: [0] }, 'arr[2]')).toBeUndefined(); // out of bounds
    });

    test('empty path returns the root object (string "" or [])', () => {
        const root = { x: 1 };
        expect(getAtPath(root, '')).toBe(root);
        expect(getAtPath(root, [])).toBe(root);
    });

    test('respects falsy values (0 / false / empty string)', () => {
        const obj = { a: 0, b: false, c: '' };
        expect(getAtPath(obj, 'a')).toBe(0);
        expect(getAtPath(obj, 'b')).toBe(false);
        expect(getAtPath(obj, 'c')).toBe('');
    });

    test('dangerous keys in string path throw (prototype pollution guard)', () => {
        expect(() => getAtPath({}, '__proto__.x')).toThrow();
        expect(() => getAtPath({}, 'constructor.prototype.y')).toThrow();
    });

    test('non-mutation: reading must not alter the original object', () => {
        const base = { a: { b: { c: 1 } }, arr: [{ v: 2 }] };
        const snapshot = JSON.parse(JSON.stringify(base));
        void getAtPath(base, 'a.b.c');
        void getAtPath(base, 'arr[0].v');
        expect(base).toStrictEqual(snapshot); // deep equal, unchanged
    });
});
