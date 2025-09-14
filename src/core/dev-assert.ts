import type { IndexStore } from '../index/index-store';

export function assertIndexes(rows: Record<string, any>, indexStore: IndexStore): void {
  const shadow: Record<string, Record<string, unknown>> = {};
  for (const [rk, row] of Object.entries(rows ?? {})) {
    if (row && typeof row === 'object') {
      for (const [ck, v] of Object.entries(row)) {
        shadow[ck] ??= {};
        shadow[ck][rk] = v;
      }
    }
  }

  const actual = indexStore.snapshot();
  const problems: string[] = [];

  const allCols = new Set([...Object.keys(shadow), ...Object.keys(actual)]);
  for (const col of allCols) {
    const a = actual[col]?.byRow ?? {};
    const b = shadow[col] ?? {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (!(k in a)) problems.push(`Index missing row "${k}" in column "${col}"`);
      else if (!(k in b)) problems.push(`Index extra row "${k}" in column "${col}"`);
      else if (!Object.is(a[k], b[k])) problems.push(`Index value mismatch at ${col}.${k}: actual=${String(a[k])} expected=${String(b[k])}`);
    }
  }

  if (problems.length) {
    const err = new Error(`assertIndexes failed:\n- ${problems.join('\n- ')}`);
    // eslint-disable-next-line no-console
    console.error(err);
    throw err;
  }
}

export function rebuildIndexes(rows: Record<string, any>, indexStore: IndexStore): void {
  indexStore.rebuildFromRows(rows);
}