import { setAtPath, getAtPath } from '../src/core/path';

describe('setAtPath – immutable updates with safe path parsing', () => {
  test('writes nested via dot + bracket and preserves unrelated branches', () => {
    const base = { a: { b: { c: 1 }, k: 123 }, z: 9 };
    const next = setAtPath(base, 'a.b.c', 42);

    // Value has been updated
    expect(getAtPath(next, 'a.b.c')).toBe(42);

    // Immutable: root and path branches are new references
    expect(next).not.toBe(base);
    expect(next.a).not.toBe(base.a);
    expect(next.a.b).not.toBe(base.a.b);

    // Unchanged branches keep the same reference
    expect(next.a.k).toBe(base.a.k);
    expect(next.z).toBe(base.z);
  });

  test('creates missing containers (object/array) along the path', () => {
    const next = setAtPath({}, 'foo[0].bar', 7);
    expect(next).toEqual({ foo: [{ bar: 7 }] });

    // Deeper: create a.b[2].c, with holes in the array
    const next2 = setAtPath({}, 'a.b[2].c', 1);
    expect(Array.isArray(next2.a.b)).toBe(true);
    expect(next2.a.b.length).toBe(3);
    expect(next2.a.b[0]).toBeUndefined();
    expect(next2.a.b[2]).toEqual({ c: 1 });
  });

  test('array updates clone only the necessary branches', () => {
    const base = { list: [{ v: 1 }, { v: 2 }, { v: 3 }] };
    const next = setAtPath(base, 'list[1].v', 9);

    // list itself is a new array (slice), but unchanged elements keep the same reference
    expect(next.list).not.toBe(base.list);
    expect(next.list[0]).toBe(base.list[0]);
    expect(next.list[2]).toBe(base.list[2]);

    // The modified element should be shallow-copied (object reference has changed)
    expect(next.list[1]).not.toBe(base.list[1]);
    expect(next.list[1].v).toBe(9);
  });

  test('dot numeric key is treated as string key (not array index)', () => {
    const next = setAtPath({}, 'map.0', 'zero');
    expect(next).toEqual({ map: { '0': 'zero' } });
    // Reading back is consistent
    expect(getAtPath(next, 'map.0')).toBe('zero');
  });

  test('out-of-bounds index extends array with holes', () => {
    const base = { a: [] as any[] };
    const next = setAtPath(base, 'a[3]', 'x');
    expect(Array.isArray(next.a)).toBe(true);
    expect(next.a.length).toBe(4);
    expect(next.a[0]).toBeUndefined();
    expect(next.a[3]).toBe('x');
    // Only "a" is changed; no new branches are created
    expect(Object.keys(next)).toEqual(['a']);
  });

  test('empty path replaces the root object', () => {
    const base = { a: 1 };
    const replaced = setAtPath(base, '', { newRoot: true } as any);
    expect(replaced).toEqual({ newRoot: true });
    // Original object should remain unchanged
    expect(base).toEqual({ a: 1 });
  });

  test('dangerous keys are rejected (prototype pollution guard)', () => {
    expect(() => setAtPath({}, '__proto__.polluted', 1)).toThrow();
    expect(() => setAtPath({}, 'constructor.prototype.x', 1)).toThrow();
  });

  test('invalid indices are rejected (string path)', () => {
    expect(() => setAtPath({}, 'arr[-1]', 1)).toThrow();
    expect(() => setAtPath({}, 'arr[abc]', 1)).toThrow();
    expect(() => setAtPath({}, 'arr[', 1)).toThrow();
  });

  test('does not mutate the original object/array (deep-compare)', () => {
    const base = { x: { y: [ { z: 1 } ] } };
    const snapshot = JSON.parse(JSON.stringify(base));
    void setAtPath(base, 'x.y[0].z', 2);
    expect(base).toStrictEqual(snapshot);
  });
});
