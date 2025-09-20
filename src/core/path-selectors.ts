/**
 * Cached selectors for fast field lookups by (rowKey, column).
 *
 * Each selector is stable and returns `s.rows[rowKey][column]`.
 * Cache keys are the string form: `${rowKey}.${column}`.
 */

// Cache selectors grouped by row for O(1) row-level operations.
const cacheByRow = new Map<string, Map<string, (s: any) => unknown>>();

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
function getSelector<S = any>(rowKey: string, column: string): FieldSelector<S> {
  let rowMap = cacheByRow.get(rowKey);
  if (!rowMap) {
    rowMap = new Map();
    cacheByRow.set(rowKey, rowMap);
  }
  const cached = rowMap.get(column) as FieldSelector<S> | undefined;
  if (cached) return cached;
  const sel: FieldSelector<S> = (s: any) => s?.rows?.[rowKey]?.[column];
  rowMap.set(column, sel as (s: any) => unknown);
  return sel;
}

/**
 * Drop all cached selectors for a given row key.
 * Used when a row is removed.
 */
function dropRow(rowKey: string) {
  cacheByRow.delete(rowKey);
}

/**
 * Rename the row key for all cached selectors.
 * Used when a row key changes.
 */
function renameRow(oldKey: string, newKey: string) {
  if (oldKey === newKey) return;
  const rowMap = cacheByRow.get(oldKey);
  if (!rowMap) return;
  cacheByRow.delete(oldKey);
  const target = cacheByRow.get(newKey);
  if (!target) {
    cacheByRow.set(newKey, rowMap);
    return;
  }
  rowMap.forEach((sel, column) => {
    if (!target.has(column)) target.set(column, sel);
  });
}

/** Clear all cached selectors. Useful in tests. */
function clearCache() {
  cacheByRow.clear();
}

export interface SelectorCacheApi {
  get: <S = any>(rowKey: string, column: string) => FieldSelector<S>;
  dropRow: (rowKey: string) => void;
  renameRow: (oldKey: string, newKey: string) => void;
  clear: () => void;
}

export const selectorCache: SelectorCacheApi = {
  get: getSelector,
  dropRow,
  renameRow,
  clear: clearCache,
};

export function makeFieldSelector<S = any>(rowKey: string, column: string): FieldSelector<S> {
  return selectorCache.get<S>(rowKey, column);
}

export function dropRowFromSelectorCache(rowKey: string) {
  selectorCache.dropRow(rowKey);
}

export function renameRowInSelectorCache(oldKey: string, newKey: string) {
  selectorCache.renameRow(oldKey, newKey);
}

export function clearSelectorCache() {
  selectorCache.clear();
}
