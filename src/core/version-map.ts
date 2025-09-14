// Column-level version with per-row increments for incremental rendering.
export interface ColumnVersion {
  version: number;
  versionByRow: Record<string, number>;
}

export interface VersionMap {
  ensureColumn: (col: string) => void;
  bump: (col: string, rowKey: string | null) => void; // null => whole column changed
  get: (col: string) => ColumnVersion;
  snapshot: () => Record<string, ColumnVersion>;
  reset: () => void;
}

export function createVersionMap(): VersionMap {
  const map: Record<string, ColumnVersion> = {};

  const ensureColumn = (col: string) => {
    if (!map[col]) map[col] = { version: 0, versionByRow: {} };
  };

  const bump = (col: string, rowKey: string | null) => {
    ensureColumn(col);
    const cv = map[col];
    cv.version += 1;
    if (rowKey) {
      cv.versionByRow[rowKey] = (cv.versionByRow[rowKey] ?? 0) + 1;
    }
  };

  const get = (col: string) => {
    ensureColumn(col);
    return map[col];
  };

  const snapshot = () => {
    const out: Record<string, ColumnVersion> = {};
    for (const [k, v] of Object.entries(map)) {
      out[k] = { version: v.version, versionByRow: { ...v.versionByRow } };
    }
    return out;
  };

  const reset = () => {
    for (const k of Object.keys(map)) delete map[k];
  };

  return { ensureColumn, bump, get, snapshot, reset };
}