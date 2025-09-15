/**
 * Cached selectors for fast field lookups by (rowKey, column).
 *
 * Each selector is stable and returns `s.rows[rowKey][column]`.
 * Cache keys are the string form: `${rowKey}.${column}`.
 */

// Store selectors as `(state) => value` to avoid generic `Function`.
const selectorCache = new Map<string, (s: any) => unknown>();

/** A selector that reads from a state object. */
export type FieldSelector<S = any> = (s: S) => unknown;

/**
 * Get or create a memoised selector for (rowKey, column).
 * The selector is cached and re-used across calls.
 *
 * @template S State shape.
 * @param rowKey Row identifier.
 * @param column Column key within the row.
 * @returns     A selector that reads `s.rows[rowKey][column]`.
 */
export function makeFieldSelector<S = any>(rowKey: string, column: string): FieldSelector<S> {
  const key = `${rowKey}.${column}`;
  const hit = selectorCache.get(key) as FieldSelector<S> | undefined;
  if (hit) return hit;
  const sel: FieldSelector<S> = (s: any) => s?.rows?.[rowKey]?.[column];
  selectorCache.set(key, sel as (s: any) => unknown);
  return sel;
}

/**
 * Drop all cached selectors for a given row key.
 * Used when a row is removed.
 */
export function dropRowFromSelectorCache(rowKey: string) {
  const prefix = `${rowKey}.`;
  selectorCache.forEach((_v, k) => {
    if (k.startsWith(prefix)) selectorCache.delete(k);
  });
}

/**
 * Rename the row key for all cached selectors.
 * Used when a row key changes.
 */
export function renameRowInSelectorCache(oldKey: string, newKey: string) {
  const oldPrefix = `${oldKey}.`;
  const toAdd: Array<[string, (s: any) => unknown]> = [];
  selectorCache.forEach((val, k) => {
    if (k.startsWith(oldPrefix)) {
      selectorCache.delete(k);
      const suffix = k.slice(oldPrefix.length);
      toAdd.push([`${newKey}.${suffix}`, val]);
    }
  });
  for (let i = 0; i < toAdd.length; i++) {
    const pair = toAdd[i];
    selectorCache.set(pair[0], pair[1]);
  }
}

/** Clear all cached selectors. Useful in tests. */
export function clearSelectorCache() {
  selectorCache.clear();
}