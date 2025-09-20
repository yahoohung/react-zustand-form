/**
 * Column and row-level version tracking for incremental rendering.
 *
 * Each column has a monotonic `version` and an optional per-row counter.
 * Selectors can use these numbers to decide when to re-compute.
 */

// Column-level version with per-row increments for incremental rendering.
/** Version data for a single column. */
export interface ColumnVersion {
  /** Total version for the column. Increases by 1 on every bump. */
  version: number;
  /** Per-row version counters. Only present for rows that were bumped. */
  versionByRow: Record<string, number>;
}

/**
 * Mutable map of column versions.
 *
 * - `ensureColumn` creates the entry if missing.
 * - `bump(col, rowKey)` increments the column version, and increments the row
 *   counter when `rowKey` is not `null`.
 * - `get` returns live data (do not mutate it outside this module).
 * - `snapshot` returns a deep copy for safe read-only use.
 * - `reset` clears everything.
 */
export interface VersionMap {
  ensureColumn: (col: string) => void;
  /**
   * Increment counters for a column. If `rowKey` is null, only the column
   * counter increases. Otherwise the specific row counter also increases.
   */
  bump: (col: string, rowKey: string | null) => void; // null => whole column changed
  /** Drop per-row counters for every column that tracks the provided row key. */
  dropRow: (rowKey: string) => void;
  /** Move per-row counters from `oldKey` to `newKey`, keeping the higher counter. */
  renameRow: (oldKey: string, newKey: string) => void;
  /** Get the live ColumnVersion for a column (created on demand). */
  get: (col: string) => ColumnVersion;
  /** Create an immutable copy of the whole structure. */
  snapshot: () => Record<string, ColumnVersion>;
  /** Remove all data. */
  reset: () => void;
}

/**
 * Creates a VersionMap instance.
 *
 * Fast and allocation-light. Avoids arrays. Keeps objects flat.
 * All methods are O(1) for the common case.
 */
export function createVersionMap(): VersionMap {
  const map: Record<string, ColumnVersion> = {};

  const ensureColumn = (col: string) => {
    if (!map[col]) map[col] = { version: 0, versionByRow: {} };
  };

  const bump = (col: string, rowKey: string | null) => {
    ensureColumn(col);
    const cv = map[col];
    cv.version += 1;
    // Explicit null check: empty string row keys are valid and bumped.
    if (rowKey !== null) {
      cv.versionByRow[rowKey] = (cv.versionByRow[rowKey] ?? 0) + 1;
    }
  };

  const get = (col: string) => {
    ensureColumn(col);
    return map[col];
  };

  const dropRow = (rowKey: string) => {
    // Empty string keys are valid, so guard only against nullish inputs.
    if (rowKey == null) return;
    for (const col of Object.keys(map)) {
      const byRow = map[col].versionByRow;
      if (rowKey in byRow) delete byRow[rowKey];
    }
  };

  const renameRow = (oldKey: string, newKey: string) => {
    if (oldKey == null || newKey == null || oldKey === newKey) return;
    for (const col of Object.keys(map)) {
      const byRow = map[col].versionByRow;
      if (!(oldKey in byRow)) continue;
      const incoming = byRow[oldKey];
      const existing = byRow[newKey];
      if (existing === undefined || incoming > existing) {
        byRow[newKey] = incoming;
      }
      delete byRow[oldKey];
    }
  };

  const snapshot = () => {
    const out: Record<string, ColumnVersion> = {};
    // Clone each column version and its row map to avoid external mutation.
    for (const [k, v] of Object.entries(map)) {
      out[k] = { version: v.version, versionByRow: { ...v.versionByRow } };
    }
    return out;
  };

  const reset = () => {
    // Delete all keys to clear the map without reallocating the object.
    for (const k of Object.keys(map)) delete map[k];
  };

  return { ensureColumn, bump, dropRow, renameRow, get, snapshot, reset };
}
