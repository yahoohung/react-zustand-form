// Column index with optional selective columns, lazy creation, and LRU pruning.
// Non-persistent by default; rebuild from rows when hydrating.

export interface ColumnIndex {
  byRow: Record<string, unknown>;
  _touched?: number; // for LRU
}

export interface IndexStoreOptions {
  whitelistColumns?: string[];
  lazy?: boolean;
  lru?: { maxColumns: number };
}

export interface IndexStore {
  getColumn: (col: string) => ColumnIndex;
  setCell: (col: string, rowKey: string, value: unknown) => void;
  removeRow: (rowKey: string) => void;
  renameRow: (oldKey: string, newKey: string) => void;
  rebuildFromRows: (rows: Record<string, any>) => void;
  snapshot: () => Record<string, ColumnIndex>;
  reset: () => void;
}

export function createIndexStore(opts: IndexStoreOptions = {}): IndexStore {
  const cols: Record<string, ColumnIndex> = {};

  // Build a Set for whitelist to make allow() O(1)
  const whitelist = opts.whitelistColumns ? new Set(opts.whitelistColumns) : null;
  const allow = (c: string) => (whitelist ? whitelist.has(c) : true);

  // Monotonic counter is faster than Date.now() and avoids syscalls
  let tick = 0;

  const ensure = (col: string) => {
    if (!cols[col]) cols[col] = { byRow: {}, _touched: ++tick };
    touch(col);
    maybePrune();
    return cols[col];
  };

  const touch = (col: string) => {
    if (cols[col]) cols[col]._touched = ++tick;
  };

  const maybePrune = () => {
    const limit = opts.lru?.maxColumns;
    if (!limit || limit <= 0) return;
    const keys = Object.keys(cols);
    const toRemove = keys.length - limit;
    if (toRemove <= 0) return;
    // Remove the least-recently touched columns without sorting the entire set.
    // This is O(n * toRemove) and usually faster than O(n log n) sort when toRemove is small.
    for (let r = 0; r < toRemove; r++) {
      let minKey: string | null = null;
      let minTouch = Infinity;
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (!k || !(k in cols)) continue; // skip already removed
        const t = cols[k]._touched ?? 0;
        if (t < minTouch) { minTouch = t; minKey = k; }
      }
      if (minKey) {
        delete cols[minKey];
        // mark removed in keys array to avoid shifting cost
        const idx = keys.indexOf(minKey);
        if (idx >= 0) keys[idx] = '' as any;
      } else {
        break;
      }
    }
  };

  const getColumn = (col: string) => {
    if (!allow(col)) return { byRow: {} };
    return ensure(col);
  };

  const setCell = (col: string, rowKey: string, value: unknown) => {
    if (!allow(col)) return;
    const c = ensure(col);
    c.byRow[rowKey] = value;
    touch(col);
  };

  const removeRow = (rowKey: string) => {
    for (const colName in cols) {
      const c = cols[colName];
      if (rowKey in c.byRow) {
        delete c.byRow[rowKey];
        touch(colName);
      }
    }
  };

  const renameRow = (oldKey: string, newKey: string) => {
    for (const colName in cols) {
      const c = cols[colName];
      if (oldKey in c.byRow) {
        c.byRow[newKey] = c.byRow[oldKey];
        delete c.byRow[oldKey];
        touch(colName);
      }
    }
  };

  const rebuildFromRows = (rowsObj: Record<string, any>) => {
    // Clear existing columns
    for (const k in cols) delete cols[k];

    // Discover allowed columns with minimal allocations
    const colSet = new Set<string>();
    for (const rk in rowsObj) {
      const row = rowsObj[rk];
      if (!row || typeof row !== 'object') continue;
      for (const ck in row) {
        if (allow(ck)) colSet.add(ck);
      }
    }

    // Ensure columns once
    colSet.forEach(col => ensure(col));

    // Populate cells without going through setCell (less overhead), then touch per column once
    const touched = new Set<string>();
    for (const rk in rowsObj) {
      const row = rowsObj[rk];
      if (!row || typeof row !== 'object') continue;
      for (const ck in row) {
        if (!allow(ck)) continue;
        const c = ensure(ck);
        c.byRow[rk] = row[ck];
        touched.add(ck);
      }
    }

    // Single touch per column (LRU) and final prune
    touched.forEach(col => touch(col));
    maybePrune();
  };

  const snapshot = () => {
    const out: Record<string, ColumnIndex> = {};
    for (const [k, v] of Object.entries(cols)) {
      out[k] = { byRow: { ...v.byRow } };
    }
    return out;
  };

  const reset = () => {
    for (const k of Object.keys(cols)) delete cols[k];
  };

  return { getColumn, setCell, removeRow, renameRow, rebuildFromRows, snapshot, reset };
}