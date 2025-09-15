/**
 * Path utilities: parse, get and set by dot/bracket paths.
 *
 * Examples of accepted paths:
 *  - "user.email"
 *  - "rows.abc[0].score"
 *  - ["rows", "abc", 0, "score"]
 */
// ------------------------------------------------------------
// src/core/path.ts
// ------------------------------------------------------------
import type { PathLike, PathSeg } from './types';

/**
 * Guard list to prevent prototype-pollution via unsafe keys.
 * Any path segment equal to one of these will throw.
 */
const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

/**
 * Throws if a key is unsafe. Used for string segments only.
 * @param key Key to check.
 * @throws Error when an unsafe key is found.
 */
function assertSafeKey(key: string) {
    if (DANGEROUS_KEYS.has(key)) throw new Error(`Unsafe key: ${key}`);
}

/**
 * Parses a dot/bracket path into an array of segments.
 *
 * Fast path: returns a shallow copy if the input is already an array.
 * Identifiers are split by dots. Numeric indices are read from bracket pairs: `[123]`.
 * Only digits are allowed inside brackets.
 *
 * @param input Path as a dot/bracket string or an array of segments.
 * @returns Array of segments (`string` and `number`).
 * @throws Error for invalid indices, unclosed brackets, or unsafe keys.
 */
export function parsePath(input: PathLike): PathSeg[] {
    // Fast path: if input is already array-like, return a shallow copy to avoid aliasing.
    if (Array.isArray(input)) return (input as unknown as PathSeg[]).slice();

    const s = String(input);
    const N = s.length;
    if (N === 0) return [];

    const out: PathSeg[] = [];
    let i = 0;

    while (i < N) {
        // read identifier (up to '.' or '[')
        let start = i;
        while (i < N) {
            const ch = s.charCodeAt(i);
            // '.'(46) '['(91)
            if (ch === 46 || ch === 91) break;
            i++;
        }
        if (i > start) {
            const id = s.slice(start, i);
            assertSafeKey(id);
            out.push(id);
        }
        if (i >= N) break;

        const ch = s.charCodeAt(i);
        if (ch === 46 /* '.' */) { i++; continue; }

        if (ch === 91 /* '[' */) {
            i++; // skip '['
            // manual integer parse: only digits allowed
            let hasDigit = false;
            let val = 0;
            while (i < N) {
                const c = s.charCodeAt(i);
                if (c === 93 /* ']' */) break;
                // '0'(48) .. '9'(57)
                if (c < 48 || c > 57) throw new Error(`Invalid index: ${s[i]}`);
                hasDigit = true;
                val = val * 10 + (c - 48);
                i++;
            }
            if (i >= N || s.charCodeAt(i) !== 93 /* ']' */) throw new Error('Unclosed bracket');
            i++; // skip ']'
            if (!hasDigit) throw new Error('Invalid index: ');
            out.push(val);
            // optional '.' after bracket
            if (i < N && s.charCodeAt(i) === 46 /* '.' */) i++;
        }
    }
    return out;
}

/**
 * Reads a value from an object by path.
 *
 * Walks the object using the parsed segments. Returns `undefined` if any parent is `null`/`undefined`.
 *
 * @template T Expected value type.
 * @param obj   Root object to read.
 * @param path  Path in string or array form.
 * @returns     The value at the leaf, or `undefined` if missing.
 */
export function getAtPath<T = any>(obj: any, path: PathLike): T | undefined {
    const parts = parsePath(path);
    let cur = obj;
    for (let i = 0; i < parts.length; i++) {
        if (cur == null) return undefined;
        // Using bracket access to support both string and numeric segments.
        cur = cur[parts[i] as any];
    }
    return cur as T;
}

/**
 * Writes a value to an object by path, returning a new root.
 *
 * Creates shallow copies along the path only. Other branches are kept by reference.
 * If the existing leaf is strictly equal to the new value, returns the original root (no-op).
 *
 * @template T   Expected root type after the write.
 * @param obj    Root object or array. May be `undefined`/`null`.
 * @param path   Path in string or array form.
 * @param value  New leaf value.
 * @returns      New root with the path updated.
 */
export function setAtPath<T extends object = any>(obj: any, path: PathLike, value: any): T {
    const parts = parsePath(path);
    const L = parts.length;
    if (L === 0) return value as T;

    // --- Fast no-op: read current leaf value first without cloning ---
    let curRead: any = obj;
    for (let i = 0; i < L - 1; i++) {
        if (curRead == null) break;
        curRead = curRead[parts[i] as any];
    }
    const leafKey = parts[L - 1] as any;
    const oldLeaf = curRead != null ? curRead[leafKey] : undefined;
    if (oldLeaf === value) return obj as T;

    // --- Write path with shallow copies only along the path ---
    const rootIsArray = Array.isArray(obj);
    const root: any = rootIsArray ? (obj ? obj.slice() : []) : (obj ? { ...obj } : {});
    let cur: any = root;

    for (let i = 0; i < L; i++) {
        const seg = parts[i] as any;
        const isLast = i === L - 1;

        // Defensive key check for string segments only
        if (typeof seg === 'string') assertSafeKey(seg);

        if (isLast) {
            cur[seg] = value;
            break;
        }

        const next = cur[seg];
        const nxtSeg = parts[i + 1];

        // Materialize the next container with minimal branching and shallow copy when needed
        let container: any;
        const needArray = typeof nxtSeg === 'number';
        if (Array.isArray(next)) {
            // Preserve array identity semantics with a shallow copy
            container = next.slice();
        } else if (needArray) {
            container = [];
        } else {
            // object branch
            container = next ? { ...next } : {};
        }

        cur[seg] = container;
        cur = container;
    }

    return root;
}
