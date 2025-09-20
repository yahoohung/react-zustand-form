/**
 * Action gate for row-based state updates.
 *
 * Provides a small, focused API to mutate `rows` while keeping
 * secondary structures (index, versions, diffs, selector cache) in sync.
 */
import type { DiffBus, FieldDiff } from './diff-bus';
import type { VersionMap } from './version-map';
import type { IndexStore } from '../index/column-index-store';
import { selectorCache } from './path-selectors';

/** A string path to a single cell. Example: "rows.user123.email" */
export type FieldPath = string;

/** Internal shape for the rows branch: rowKey -> column -> value */
type RowsShape = Record<string, Record<string, unknown>>;

/**
 * Dependencies required by the action gate.
 * @template S Store state with a `rows` branch compatible with {@link RowsShape}.
 */
export interface ActionGateDeps<S> {
  /** Returns the latest store snapshot. */
  getState: () => S;
  /** Applies a partial update. May accept an optional action name for dev tools. */
  setState: (partial: Partial<S>, replace?: boolean, actionName?: string) => void;
  /** Publishes diffs whenever cells change. */
  diffBus: DiffBus;
  /** Bumps versions per cell so selectors can invalidate. */
  versionMap: VersionMap;
  /** Cell-level indexing for fast lookups. */
  indexStore: IndexStore;
}

/**
 * Public API for row operations. All methods are atomic and keep
 * index, version map and diff bus in step with the store.
 */
export interface ActionGate {
  /** Apply many server patches in one go, with a light rebase if state changed. */
  applyPatches: (patches: Record<FieldPath, unknown>) => void;
  /** Update one field locally. No-op if value is unchanged. */
  updateField: (path: FieldPath, next: unknown) => void;
  /** Insert a whole row atomically. */
  addRow: (rowKey: string, row: Record<string, unknown>) => void;
  /** Remove a whole row and invalidate related caches. */
  removeRow: (rowKey: string) => void;
  /** Rename a row key atomically. */
  renameRow: (oldKey: string, newKey: string) => void;
}

/**
 * Guards against prototype-pollution style keys in any path segment.
 * This is a defensive check. It keeps updates safe when paths are external.
 */
const __BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const __hasBadSegment = (seg: string) => __BAD_KEYS.has(seg);

/**
 * Parses a FieldPath into `{ rowKey, column }`.
 *
 * Accepts: "rows.<rowKey>.<column...>". The column may contain dots.
 * Rejects empty segments and known dangerous keys.
 * Fast path: avoids array allocations to keep GC pressure low.
 *
 * @param path Full field path string.
 * @returns Parts if valid, otherwise `null`.
 */
function splitPath(path: string): { rowKey: string; column: string } | null {
  // Expect "rows.<rowKey>.<column...>". Avoids array allocations; rejects dangerous keys.
  if (!path.startsWith('rows.')) return null;
  const firstDot = path.indexOf('.', 5); // after "rows."
  if (firstDot === -1) return null;
  const rowKey = path.slice(5, firstDot);
  if (!rowKey || __hasBadSegment(rowKey)) return null;
  const column = path.slice(firstDot + 1);
  if (!column) return null;
  // sanity check column segments (dot-separated); fast scan without splitting to arrays
  let i = 0, j = 0;
  // iterate and check each segment between dots
  // (we avoid allocating an array to keep GC low)
  while (j <= column.length) {
    if (j === column.length || column.charCodeAt(j) === 46 /* '.' */) {
      const seg = column.slice(i, j);
      if (!seg || __hasBadSegment(seg)) return null;
      i = j + 1;
    }
    j++;
  }
  return { rowKey, column };
}

/** Type guard: ensure a diff carries a concrete rowKey string. */
const hasRowKey = (d: FieldDiff): d is FieldDiff & { rowKey: string } =>
  typeof (d as any).rowKey === 'string' && (d as any).rowKey.length > 0;

/** Type guard: ensure a diff carries concrete rowKey and column strings. */
const hasCellCoords = (d: FieldDiff): d is FieldDiff & { rowKey: string; column: string } =>
  typeof (d as any).rowKey === 'string' && (d as any).rowKey.length > 0 &&
  typeof (d as any).column === 'string' && (d as any).column.length > 0;

/** Type guard: insert/update cell diffs that carry a `next` value. */
const isUpsertCellDiff = (
  d: FieldDiff
): d is FieldDiff & { rowKey: string; column: string; next: unknown; kind: 'insert' | 'update' } =>
  hasCellCoords(d) && (d as any).kind !== undefined && ((d as any).kind === 'insert' || (d as any).kind === 'update') && ('next' in (d as any));

/**
 * Creates an action gate that manages row-based updates for a Zustand-like store.
 *
 * The gate:
 *  - writes to `rows` with a single commit per operation;
 *  - bumps versions per cell;
 *  - keeps the index store in sync;
 *  - publishes diffs for observers;
 *  - updates selector cache when removing/renaming rows.
 *
 * @template S Store state type containing a `rows` branch.
 * @param deps External dependencies (state access, diff bus, version map, index store).
 * @returns A small API for atomic row operations.
 */
export function createActionGate<S extends { rows: RowsShape }>(deps: ActionGateDeps<S>): ActionGate {
  const { getState, setState, diffBus, versionMap, indexStore } = deps;

  /**
   * Writes a single cell to the rows branch in an immutable way.
   * Returns `false` if the value is unchanged. Triggers a named action.
   */
  const setRowsBranch = (rowKey: string, column: string, value: unknown) => {
    const s = getState();
    const prevRow = s.rows[rowKey] ?? {};
    if ((prevRow as any)[column] === value) return false; // early return
    const nextRow = { ...prevRow, [column]: value };
    const nextRows = { ...s.rows, [rowKey]: nextRow } as RowsShape;
    setState({ rows: nextRows } as Partial<S>, false, 'rows/updateField');
    return true;
  };

  /**
   * Applies server-originated patches in one commit.
   * Builds diffs against a snapshot, then rebases once if concurrent changes occurred.
   * Publishes an array of diffs and updates index/version strictly for applied cells.
   * @param patches Map of FieldPath to next value.
   */
  const applyPatches = (patches: Record<FieldPath, unknown>) => {
    const buildDiffs = (rows: RowsShape) => {
      const diffs: FieldDiff[] = [];
      let drafts: RowsShape | null = null;
      const rowDrafts = new Map<string, Record<string, unknown>>();

      const ensureDraft = (rowKey: string) => {
        let draft = rowDrafts.get(rowKey);
        if (draft) return draft;
        if (!drafts) drafts = { ...rows };
        draft = { ...(drafts[rowKey] ?? rows[rowKey] ?? {}) };
        drafts[rowKey] = draft;
        rowDrafts.set(rowKey, draft);
        return draft;
      };

      for (const [path, value] of Object.entries(patches)) {
        const sc = splitPath(path);
        if (!sc) continue;
        const { rowKey, column } = sc;

        const currentBase = drafts ? drafts : rows;
        const prevRow = currentBase[rowKey] ?? rows[rowKey] ?? {};
        const prevVal = (prevRow as any)[column];
        if (prevVal === value) continue;

        const draft = ensureDraft(rowKey);
        draft[column] = value;

        diffs.push({
          kind: prevVal === undefined ? 'insert' : 'update',
          path,
          prev: prevVal,
          next: value,
          rowKey,
          column,
          source: 'server',
        });
      }

      return { diffs, nextRows: drafts ?? rows };
    };

    const s0 = getState();
    let { diffs, nextRows } = buildDiffs(s0.rows);
    if (diffs.length === 0) return;

    const s1 = getState();
    if (s1.rows !== s0.rows) {
      const recomputed = buildDiffs(s1.rows);
      if (recomputed.diffs.length === 0) {
        return;
      }
      diffs = recomputed.diffs;
      nextRows = recomputed.nextRows;
    }

    setState({ rows: nextRows } as Partial<S>, false, 'rows/applyPatches');

    for (let i = 0; i < diffs.length; i++) {
      const d = diffs[i];
      if (!isUpsertCellDiff(d)) continue;
      indexStore.setCell(d.column, d.rowKey, d.next);
      versionMap.bump(d.column, d.rowKey);
    }

    diffBus.publish(diffs);
  };

  /**
   * Updates a single field locally. No-ops if the value matches the current one.
   * Publishes exactly one diff and updates index/version for that cell.
   * @param rawPath FieldPath to update.
   * @param next Next value for the cell.
   */
  const updateField = (rawPath: FieldPath, next: unknown) => {
    const path = rawPath;
    const sc = splitPath(path);
    if (!sc) return;
    const { rowKey, column } = sc;

    const s = getState();
    const prevVal = s.rows[rowKey]?.[column];
    if (prevVal === next) return;

    if (setRowsBranch(rowKey, column, next)) {
      // Defensive: rowKey is a concrete string here by construction.
      indexStore.setCell(column, rowKey, next);
      versionMap.bump(column, rowKey);
      diffBus.publish([
        {
          kind: prevVal === undefined ? 'insert' : 'update',
          path,
          prev: prevVal,
          next,
          rowKey,
          column,
          source: 'local',
        },
      ]);
    }
  };

  /**
   * Inserts a whole row atomically.
   * Index and version map are updated per cell. Publishes a batch of insert diffs.
   * @param rowKey New row key.
   * @param row Map of column to value.
   */
  const addRow = (rowKey: string, row: Record<string, unknown>) => {
    const s = getState();
    if (s.rows[rowKey]) return;
    const nextRows = { ...s.rows, [rowKey]: { ...row } } as RowsShape;
    setState({ rows: nextRows } as Partial<S>, false, 'rows/addRow');

    const diffs: FieldDiff[] = [];
    // Index-based loop to satisfy ESLint rules that restrict `for..of`.
    const __entriesAdd = Object.entries(row);
    for (let i = 0; i < __entriesAdd.length; i++) {
      const pair = __entriesAdd[i];
      const col = pair[0];
      const val = pair[1];
      indexStore.setCell(col, rowKey, val);
      versionMap.bump(col, rowKey);
      diffs.push({
        kind: 'insert',
        path: `rows.${rowKey}.${col}`,
        next: val,
        rowKey,
        column: col,
        source: 'local'
      });
    }
    diffBus.publish(diffs);
  };

  /**
   * Removes a whole row.
   * Drops selector cache for that row and clears index entries. Publishes remove diffs.
   * @param rowKey Existing row key to remove.
   */
  const removeRow = (rowKey: string) => {
    const s = getState();
    const prev = s.rows[rowKey];
    if (!prev) return;

    // Clean dependent data structures before mutating rows
    versionMap.dropRow(rowKey);
    selectorCache.dropRow(rowKey);
    indexStore.removeRow(rowKey);

    const nextRows = { ...s.rows } as RowsShape;
    delete nextRows[rowKey];
    setState({ rows: nextRows } as Partial<S>, false, 'rows/removeRow');

    const diffs: FieldDiff[] = [];
    // Index-based loop to satisfy ESLint rules that restrict `for..of`.
    const __entriesRemove = Object.entries(prev);
    for (let i = 0; i < __entriesRemove.length; i++) {
      const pair = __entriesRemove[i];
      const col = pair[0];
      const val = pair[1];
      versionMap.bump(col, null);
      diffs.push({
        kind: 'remove',
        path: `rows.${rowKey}.${col}`,
        prev: val,
        rowKey,
        column: col,
        source: 'local'
      });
    }
    diffBus.publish(diffs);
  };

  /**
   * Renames a row key atomically.
   * Updates index, bumps versions for the new key, updates selector cache, and publishes rename diffs.
   * @param oldKey Existing row key.
   * @param newKey New row key.
   */
  const renameRow = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;
    const s = getState();
    const prev = s.rows[oldKey];
    if (!prev || s.rows[newKey]) return;

    const nextRows = { ...s.rows } as RowsShape;
    delete nextRows[oldKey];
    nextRows[newKey] = { ...prev };
    setState({ rows: nextRows } as Partial<S>, false, 'rows/renameRow');

    const diffs: FieldDiff[] = [];
    // Index-based loop to satisfy ESLint rules that restrict `for..of`.
    const __entriesRename = Object.entries(prev);
    for (let i = 0; i < __entriesRename.length; i++) {
      const col = __entriesRename[i][0];
      versionMap.bump(col, newKey);
      diffs.push({
        kind: 'rename',
        path: `rows.${newKey}.${col}`,
        prev: oldKey,
        next: newKey,
        rowKey: newKey,
        column: col,
        source: 'local'
      });
    }
    versionMap.renameRow(oldKey, newKey);
    selectorCache.renameRow(oldKey, newKey);
    indexStore.renameRow(oldKey, newKey);
    diffBus.publish(diffs);
  };

  return { applyPatches, updateField, addRow, removeRow, renameRow };
}
