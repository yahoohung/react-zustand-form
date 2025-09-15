/****
 * Development‑time index validation helpers.
 *
 * Compare the live index store against a shadow built from the current rows.
 * Used only in development to detect out‑of‑sync or corrupted index data.
 */
import type { IndexStore } from '../index/column-index-store';

/**
 * Rebuilds a shadow index from the current rows and compares it to the live index store.
 * Throws an error when differences are found.
 *
 * Checks for:
 * - Missing rows in a column.
 * - Extra rows in a column.
 * - Value mismatch for a cell.
 *
 * @param rows       Current rows object to verify.
 * @param indexStore Index store to validate.
 * @throws Error when any mismatch is detected.
 */
export function assertIndexes(rows: Record<string, any>, indexStore: IndexStore): void {
  const shadow: Record<string, Record<string, unknown>> = {};
  Object.entries(rows ?? {}).forEach(([rk, row]) => {
    if (row && typeof row === 'object') {
      Object.entries(row).forEach(([ck, v]) => {
        shadow[ck] ??= {};
        shadow[ck][rk] = v;
      });
    }
  });

  const actual = indexStore.snapshot();
  const problems: string[] = [];

  const allCols = new Set([...Object.keys(shadow), ...Object.keys(actual)]);
  allCols.forEach((col) => {
    const a = actual[col]?.byRow ?? {};
    const b = shadow[col] ?? {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    keys.forEach((k) => {
      if (!(k in a)) problems.push(`Index missing row "${k}" in column "${col}"`);
      else if (!(k in b)) problems.push(`Index extra row "${k}" in column "${col}"`);
      else if (!Object.is(a[k], b[k])) problems.push(`Index value mismatch at ${col}.${k}: actual=${String(a[k])} expected=${String(b[k])}`);
    });
  });

  if (problems.length) {
    const err = new Error(`assertIndexes failed:\n- ${problems.join('\n- ')}`);
    // eslint-disable-next-line no-console
    console.error(err);
    throw err;
  }
}

/**
 * Rebuild the index store from scratch using the current rows.
 * Useful in development to recover from detected mismatches.
 *
 * @param rows       Source rows to rebuild from.
 * @param indexStore Index store to update.
 */
export function rebuildIndexes(rows: Record<string, any>, indexStore: IndexStore): void {
  indexStore.rebuildFromRows(rows);
}