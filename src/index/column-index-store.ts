/**
 * Column index store backed by Maps for predictable LRU pruning.
 */

export interface ColumnIndex {
  byRow: Record<string, unknown>;
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

interface ColumnEntry {
  map: Map<string, unknown>;
  view: ColumnIndex;
}

export function createIndexStore(opts: IndexStoreOptions = {}): IndexStore {
  const columns = new Map<string, ColumnEntry>();
  const rowToColumns = new Map<string, Set<string>>();

  const whitelist = opts.whitelistColumns ? new Set(opts.whitelistColumns) : null;
  const allowColumn = (col: string) => (whitelist ? whitelist.has(col) : true);

  const rawMaxColumns = opts.lru?.maxColumns ?? 1000;
  const maxColumns = rawMaxColumns <= 0 ? 1 : rawMaxColumns;
  let columnCount = 0;

  const emptyView: ColumnIndex = { byRow: Object.freeze({}) };

  const updateRowLink = (rowKey: string, column: string, present: boolean) => {
    if (present) {
      let set = rowToColumns.get(rowKey);
      if (!set) {
        set = new Set<string>();
        rowToColumns.set(rowKey, set);
      }
      set.add(column);
      return;
    }
    const set = rowToColumns.get(rowKey);
    if (!set) return;
    set.delete(column);
    if (set.size === 0) rowToColumns.delete(rowKey);
  };

  const maybePrune = () => {
    if (columnCount <= maxColumns) return;
    while (columnCount > maxColumns) {
      const next = columns.keys().next();
      if (next.done) break;
      const oldest = next.value;
      const entry = columns.get(oldest);
      if (entry) {
        entry.map.forEach((_value, rowKey) => {
          const set = rowToColumns.get(rowKey);
          if (set) {
            set.delete(oldest);
            if (set.size === 0) rowToColumns.delete(rowKey);
          }
        });
      }
      if (columns.delete(oldest)) {
        columnCount -= 1;
      }
    }
  };

  const touchColumn = (col: string, entry: ColumnEntry) => {
    columns.delete(col);
    columns.set(col, entry);
    return entry;
  };

  const ensureColumn = (col: string, createIfMissing = true): ColumnEntry | null => {
    if (!allowColumn(col)) return null;
    const existing = columns.get(col);
    if (existing) {
      return touchColumn(col, existing);
    }
    if (!createIfMissing) return null;

    const map = new Map<string, unknown>();
    const view: ColumnIndex = { byRow: Object.create(null) };
    const entry: ColumnEntry = { map, view };
    columns.set(col, entry);
    columnCount += 1;
    maybePrune();
    return columns.get(col) ?? null;
  };

  const getColumn = (col: string): ColumnIndex => {
    const entry = ensureColumn(col, opts.lazy === false);
    return entry ? entry.view : emptyView;
  };

  const setCell = (col: string, rowKey: string, value: unknown) => {
    const entry = ensureColumn(col);
    if (!entry) return;
    const present = value !== undefined;
    if (present) {
      entry.map.set(rowKey, value);
      entry.view.byRow[rowKey] = value;
    } else {
      entry.map.delete(rowKey);
      delete entry.view.byRow[rowKey];
    }
    updateRowLink(rowKey, col, present);
    maybePrune();
  };

  const removeRow = (rowKey: string) => {
    const cols = rowToColumns.get(rowKey);
    if (!cols) return;
    cols.forEach((col) => {
      const entry = columns.get(col);
      if (!entry) return;
      if (entry.map.delete(rowKey)) {
        delete entry.view.byRow[rowKey];
      }
    });
    rowToColumns.delete(rowKey);
  };

  const renameRow = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;
    const cols = rowToColumns.get(oldKey);
    if (!cols) return;
    let dst = rowToColumns.get(newKey);
    if (!dst) {
      dst = new Set<string>();
      rowToColumns.set(newKey, dst);
    }
    const target = dst;
    cols.forEach((col) => {
      const entry = columns.get(col);
      if (!entry) return;
      if (!entry.map.has(oldKey)) return;
      const value = entry.map.get(oldKey);
      if (value !== undefined) {
        entry.map.delete(oldKey);
        entry.map.set(newKey, value);
        delete entry.view.byRow[oldKey];
        entry.view.byRow[newKey] = value;
        target.add(col);
      }
    });
    rowToColumns.delete(oldKey);
  };

  const rebuildFromRows = (rows: Record<string, any>) => {
    columns.clear();
    rowToColumns.clear();
    columnCount = 0;

    Object.entries(rows ?? {}).forEach(([rowKey, row]) => {
      if (!row || typeof row !== 'object') return;
      Object.entries(row).forEach(([col, value]) => {
        if (!allowColumn(col)) return;
        const entry = ensureColumn(col);
        if (!entry) return;
        entry.map.set(rowKey, value);
        entry.view.byRow[rowKey] = value;
        updateRowLink(rowKey, col, true);
      });
    });
    maybePrune();
  };

  const snapshot = () => {
    const out: Record<string, ColumnIndex> = {};
    columns.forEach((entry, col) => {
      out[col] = { byRow: { ...entry.view.byRow } };
    });
    return out;
  };

  const reset = () => {
    columns.clear();
    rowToColumns.clear();
    columnCount = 0;
  };

  return { getColumn, setCell, removeRow, renameRow, rebuildFromRows, snapshot, reset };
}
