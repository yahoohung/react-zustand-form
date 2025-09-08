import { parsePath } from '../src';

/**
 * Comprehensive parsePath test suite (RZF semantics)
 * - Supports dot + numeric brackets only (e.g., a.b[0].c)
 * - Throws on invalid indices / unclosed brackets
 * - Guards dangerous keys (__proto__/constructor/prototype) on dot segments
 * - Tolerates extra dots and missing dot after a bracket (e.g., a[0]b)
 * - Array-form path returns a shallow copy as-is (no re-validation)
 */

describe('parsePath – comprehensive suite', () => {
  // === Happy paths ===
  test('parses simple dot path', () => {
    expect(parsePath('user.name')).toEqual(['user', 'name']);
  });

  test('parses bracket numeric indices', () => {
    expect(parsePath('items[0].qty')).toEqual(['items', 0, 'qty']);
    expect(parsePath('a.b[10].c[2].d')).toEqual(['a', 'b', 10, 'c', 2, 'd']);
  });

  test('parses dot-numeric-key as STRING segment (not array index)', () => {
    // "map.0" should be treated as ['map', '0'], not ['map', 0]
    expect(parsePath('map.0')).toEqual(['map', '0']);
  });

  test('tolerates extra dots and leading/trailing dots', () => {
    expect(parsePath('.a')).toEqual(['a']);           // leading dot ignored
    expect(parsePath('a.')).toEqual(['a']);           // trailing dot ignored
    expect(parsePath('a..b')).toEqual(['a', 'b']);    // double dot collapses
  });

  test('allows missing dot right after bracket (a[0]b ≡ a[0].b)', () => {
    expect(parsePath('a[0]b')).toEqual(['a', 0, 'b']);
    expect(parsePath('a[0].b')).toEqual(['a', 0, 'b']);
  });

  test('supports starting with a bracket and consecutive brackets', () => {
    expect(parsePath('[0].a')).toEqual([0, 'a']);
    expect(parsePath('a[0][1]')).toEqual(['a', 0, 1]);
  });

  test('accepts leading zeros in numeric index (still decimal)', () => {
    // Implementation accepts "01" as index 1
    expect(parsePath('arr[01]')).toEqual(['arr', 1]);
  });

  // === Array path input behavior ===
  test('array path input returns a shallow copy (no mutation), preserving types', () => {
    const inPath = ['a', 0, 'b'] as const;
    const outPath = parsePath(inPath);
    expect(outPath).toEqual(['a', 0, 'b']);
    expect(outPath).not.toBe(inPath); // must be a copy
    // NOTE: No dangerous-key verification for array-form input by design (internal-only).
  });

  // === Safety: dangerous keys ===
  test('throws on dangerous keys in dot segments (prototype pollution guard)', () => {
    expect(() => parsePath('__proto__.x')).toThrow();
    expect(() => parsePath('constructor.prototype.y')).toThrow();
    expect(() => parsePath('a.__proto__')).toThrow();
  });

  // === Invalid indices & malformed bracket syntax ===
  test('throws on invalid indices (negative / float / non-numeric / scientific)', () => {
    expect(() => parsePath('arr[-1]')).toThrow();
    expect(() => parsePath('arr[1.5]')).toThrow();
    expect(() => parsePath('arr[abc]')).toThrow();
    expect(() => parsePath('arr[1e2]')).toThrow();
  });

  test('throws on empty or spaced indices inside brackets', () => {
    expect(() => parsePath('arr[]')).toThrow();       // empty
    expect(() => parsePath('arr[ ]')).toThrow();      // space only
    expect(() => parsePath('arr[ 1 ]')).toThrow();    // spaces around digits (not trimmed)
  });

  test('throws on unclosed bracket', () => {
    expect(() => parsePath('arr[1')).toThrow();
  });

  // === Edge semantics ===
  test('empty string path yields empty segments (caller may treat as root)', () => {
    expect(parsePath('')).toEqual([]);
  });

  test('complex mix remains consistent', () => {
    // Mix: leading dot, double dots, brackets without dot, trailing dot
    expect(parsePath('.a..b[2]c.')).toEqual(['a', 'b', 2, 'c']);
  });

  // === Robustness / longer path ===
  test('handles long nested path without stack or allocation issues', () => {
    const p = 'a.b[0].c.d[1].e.f[2].g.h[3].i';
    expect(parsePath(p)).toEqual(['a','b',0,'c','d',1,'e','f',2,'g','h',3,'i']);
  });
});
