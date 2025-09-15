/**
 * Column index store.
 *
 * Maintains a reverse index of table data for fast column‑wise lookups.
 * Supports optional column whitelisting, lazy creation and LRU pruning.
 * Non‑persistent by default; call rebuildFromRows when hydrating from saved rows.
 */

/**
 * Data for a single column index.
 * - byRow: maps each row key to its value in this column.
 * - _touched: monotonic counter used for LRU pruning.
 */
export interface ColumnIndex {
  byRow: Record<string, unknown>;
  _touched?: number; // for LRU
}

/**
 * Options to control index behaviour.
 * - whitelistColumns: if provided, only these columns are indexed.
 * - lazy: if true, only build indexes when accessed.
 * - lru: limit on number of columns to keep; least recently used are pruned.
 */
export interface IndexStoreOptions {
  whitelistColumns?: string[];
  lazy?: boolean;
  lru?: { maxColumns: number };
}

/**
 * Public API of the column index store.
 * Provides methods to read or update the index and to rebuild or reset it.
 */
export interface IndexStore {
  getColumn: (col: string) => ColumnIndex;
  setCell: (col: string, rowKey: string, value: unknown) => void;
  removeRow: (rowKey: string) => void;
  renameRow: (oldKey: string, newKey: string) => void;
  rebuildFromRows: (rows: Record<string, any>) => void;
  snapshot: () => Record<string, ColumnIndex>;
  reset: () => void;
}

/**
 * Create a new column index store.
 *
 * @param opts  Optional settings for whitelisting, lazy creation and LRU.
 * @returns     An IndexStore with methods to manage column indexes.
 */
export function createIndexStore(opts: IndexStoreOptions = {}): IndexStore {
  // Internal map of column name -> ColumnIndex
  const cols: Record<string, ColumnIndex> = {};

  // Precompute whitelist set for O(1) checks if provided
  const whitelist = opts.whitelistColumns ? new Set(opts.whitelistColumns) : null;
  const allow = (c: string) => (whitelist ? whitelist.has(c) : true);

  // Monotonic counter used to track recent access without Date.now()
  let tick = 0;

  // Ensure a column index exists (no prune here)
  const ensure = (col: string) => {
    if (!cols[col]) cols[col] = { byRow: {}, _touched: ++tick };
    return cols[col];
  };

  const touch = (col: string) => {
    if (cols[col]) cols[col]._touched = ++tick;
  };

  // Remove least‑recently used columns when over LRU limit
  const maybePrune = () => {
    const limit = opts.lru?.maxColumns;
    if (limit == null) return;

    // Special case: keep at most one column when limit <= 0
    if (limit <= 0) {
      while (Object.keys(cols).length > 1) {
        let oldestKey: string | null = null;
        let oldestTick = Infinity;
        for (const k in cols) {
          const t = cols[k]._touched ?? 0;
          if (t < oldestTick) { oldestTick = t; oldestKey = k; }
        }
        if (oldestKey) delete cols[oldestKey]; else break;
      }
      return;
    }

    // Evict until we are within the limit
    while (Object.keys(cols).length > limit) {
      let oldestKey: string | null = null;
      let oldestTick = Infinity;
      for (const k in cols) {
        const t = cols[k]._touched ?? 0;
        if (t < oldestTick) { oldestTick = t; oldestKey = k; }
      }
      if (oldestKey) delete cols[oldestKey]; else break;
    }
  };

  // Retrieve a column index, creating it if allowed and needed
  const getColumn = (col: string) => {
    if (!allow(col)) return { byRow: {} };
    const c = ensure(col);
    // mark read access for LRU
    touch(col);
    return c;
  };

  // Set or update a single cell value and mark column as recently used
  const setCell = (col: string, rowKey: string, value: unknown) => {
    if (!allow(col)) return;
    const c = ensure(col);
    c.byRow[rowKey] = value;
    // Mark as recently updated then prune if over limit
    touch(col);
    maybePrune();
  };

  // Remove a row key from all columns
  const removeRow = (rowKey: string) => {
    for (const colName in cols) {
      const c = cols[colName];
      if (rowKey in c.byRow) {
        delete c.byRow[rowKey];
        touch(colName);
      }
    }
  };

  // Rename a row key across all columns
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

  // Rebuild the entire index from a fresh rows object
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
        const c = cols[ck]; // already ensured above
        c.byRow[rk] = row[ck];
        touched.add(ck);
      }
    }

    // Single touch per column (LRU) and final prune
    touched.forEach(col => touch(col));
    maybePrune();
  };

  // Create a shallow copy of the current index for inspection or debugging
  const snapshot = () => {
    const out: Record<string, ColumnIndex> = {};
    Object.entries(cols).forEach(([k, v]) => {
      out[k] = { byRow: { ...v.byRow } };
    });
    return out;
  };

  // Remove all columns and reset the store to empty
  const reset = () => {
    Object.keys(cols).forEach((k) => { delete cols[k]; });
  };

  return { getColumn, setCell, removeRow, renameRow, rebuildFromRows, snapshot, reset };
}