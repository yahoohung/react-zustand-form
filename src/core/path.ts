// ------------------------------------------------------------
// src/core/path.ts
// ------------------------------------------------------------
import type { PathLike, PathSeg } from './types';

const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function assertSafeKey(k: string) {
    if (DANGEROUS_KEYS.has(k)) throw new Error(`Unsafe key: ${k}`);
}

export function parsePath(input: PathLike): PathSeg[] {
    if (Array.isArray(input)) return Array.from(input as ReadonlyArray<PathSeg>);
    const s = String(input);
    if (!s) return [];
    const out: PathSeg[] = [];
    let i = 0;
    const N = s.length;
    while (i < N) {
        // read identifier
        let id = '';
        while (i < N) {
            const ch = s[i];
            if (ch === '.' || ch === '[') break;
            id += ch; i++;
        }
        if (id) {
            assertSafeKey(id);
            out.push(id);
        }
        if (i >= N) break;
        const ch = s[i];
        if (ch === '.') { i++; continue; }
        if (ch === '[') {
            // only numeric indices supported in MVP
            i++; // skip [
            let num = '';
            while (i < N && s[i] !== ']') { num += s[i++]; }
            if (i >= N) throw new Error('Unclosed bracket');
            i++; // skip ]
            if (!/^\d+$/.test(num)) throw new Error(`Invalid index: ${num}`);
            const idx = Number(num);
            if (idx < 0 || !Number.isInteger(idx)) throw new Error(`Invalid index: ${num}`);
            out.push(idx);
            if (i < N && s[i] === '.') i++;
        }
    }
    return out;
}

export function getAtPath<T = any>(obj: any, path: PathLike): T | undefined {
    const parts = parsePath(path);
    let cur = obj;
    for (const p of parts) {
        if (cur == null) return undefined;
        cur = cur[p as any];
    }
    return cur as T;
}

export function setAtPath<T extends object = any>(obj: any, path: PathLike, value: any): T {
    const parts = parsePath(path);
    if (parts.length === 0) return value as T;
    const rootIsArray = Array.isArray(obj);
    const root: any = rootIsArray ? obj.slice() : { ...(obj ?? {}) };
    let cur: any = root;
    for (let i = 0; i < parts.length; i++) {
        const seg = parts[i];
        const isLast = i === parts.length - 1;
        if (typeof seg === 'number') {
            const next = cur[seg];
            if (isLast) {
                cur[seg] = value;
            } else {
                const nxtSeg = parts[i + 1];
                const container = Array.isArray(next) || typeof nxtSeg === 'number' ? (Array.isArray(next) ? next.slice() : []) : ({ ...(next ?? {}) });
                cur[seg] = container;
                cur = container;
            }
        } else {
            assertSafeKey(seg);
            const next = cur[seg];
            if (isLast) {
                cur[seg] = value;
            } else {
                const nxtSeg = parts[i + 1];
                const container = Array.isArray(next) || typeof nxtSeg === 'number' ? (Array.isArray(next) ? next.slice() : []) : ({ ...(next ?? {}) });
                cur[seg] = container;
                cur = container;
            }
        }
    }
    return root;
}

