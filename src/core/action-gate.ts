import type { DiffBus, FieldDiff } from './diff-bus';
import type { VersionMap } from './version-map';
import type { IndexStore } from '../index/index-store';
import { dropRowFromSelectorCache, renameRowInSelectorCache } from './path-selectors';

export type FieldPath = string;

export interface ActionGateDeps<S> {
  getState: () => S;
  setState: (partial: Partial<S>, replace?: boolean, actionName?: string) => void;
  diffBus: DiffBus;
  versionMap: VersionMap;
  indexStore: IndexStore;
}

export interface ActionGate {
  applyPatches: (patches: Record<FieldPath, unknown>) => void;
  updateField: (path: FieldPath, next: unknown) => void;
  addRow: (rowKey: string, row: Record<string, unknown>) => void;
  removeRow: (rowKey: string) => void;
  renameRow: (oldKey: string, newKey: string) => void;
}

type RowsShape = Record<string, Record<string, unknown>>;

function splitPath(path: string): { rowKey: string; column: string } | null {
  // Expect "rows.<rowKey>.<column...>". Avoids array allocations.
  if (!path.startsWith('rows.')) return null;
  const firstDot = path.indexOf('.', 5); // after "rows."
  if (firstDot === -1) return null;
  const rowKey = path.slice(5, firstDot);
  if (!rowKey) return null;
  const column = path.slice(firstDot + 1);
  if (!column) return null;
  return { rowKey, column };
}

export function createActionGate<S extends { rows: RowsShape }>(deps: ActionGateDeps<S>): ActionGate {
  const { getState, setState, diffBus, versionMap, indexStore } = deps;

  const setRowsBranch = (rowKey: string, column: string, value: unknown) => {
    const s = getState();
    const prevRow = s.rows[rowKey] ?? {};
    if ((prevRow as any)[column] === value) return false; // early return
    const nextRow = { ...prevRow, [column]: value };
    const nextRows = { ...s.rows, [rowKey]: nextRow } as RowsShape;
    setState({ rows: nextRows } as Partial<S>, false, 'rows/updateField');
    return true;
  };

  const applyPatches = (patches: Record<FieldPath, unknown>) => {
    const s = getState();
    const diffs: FieldDiff[] = [];
    let nextRows: RowsShape | null = null;

    for (const [path, value] of Object.entries(patches)) {
      const sc = splitPath(path);
      if (!sc) continue;
      const { rowKey, column } = sc;

      const base = nextRows ?? s.rows;
      const prevRow = base[rowKey] ?? {};
      const prevVal = (prevRow as any)[column];
      if (prevVal === value) continue;

      if (!nextRows) nextRows = { ...s.rows };
      const newRow = { ...prevRow, [column]: value };
      nextRows[rowKey] = newRow;

      indexStore.setCell(column, rowKey, value);
      versionMap.bump(column, rowKey);

      diffs.push({
        kind: prevVal === undefined ? 'insert' : 'update',
        path,
        prev: prevVal,
        next: value,
        rowKey,
        column,
        source: 'server'
      });
    }

    if (nextRows) setState({ rows: nextRows } as Partial<S>, false, 'rows/applyPatches');
    if (diffs.length) diffBus.publish(diffs);
  };

  const updateField = (rawPath: FieldPath, next: unknown) => {
    const path = rawPath;
    const sc = splitPath(path);
    if (!sc) return;
    const { rowKey, column } = sc;

    const s = getState();
    const prevVal = s.rows[rowKey]?.[column];
    if (prevVal === next) return;

    if (setRowsBranch(rowKey, column, next)) {
      indexStore.setCell(column, rowKey, next);
      versionMap.bump(column, rowKey);
      diffBus.publish({
        kind: prevVal === undefined ? 'insert' : 'update',
        path,
        prev: prevVal,
        next,
        rowKey,
        column,
        source: 'local'
      });
    }
  };

  const addRow = (rowKey: string, row: Record<string, unknown>) => {
    const s = getState();
    if (s.rows[rowKey]) return;
    const nextRows = { ...s.rows, [rowKey]: { ...row } } as RowsShape;
    setState({ rows: nextRows } as Partial<S>, false, 'rows/addRow');

    const diffs: FieldDiff[] = [];
    for (const [col, val] of Object.entries(row)) {
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

  const removeRow = (rowKey: string) => {
    const s = getState();
    const prev = s.rows[rowKey];
    if (!prev) return;

    const nextRows = { ...s.rows } as RowsShape;
    delete nextRows[rowKey];
    setState({ rows: nextRows } as Partial<S>, false, 'rows/removeRow');

    // remove once across all columns
    indexStore.removeRow(rowKey);

    const diffs: FieldDiff[] = [];
    for (const [col, val] of Object.entries(prev)) {
      versionMap.bump(col, rowKey);
      diffs.push({
        kind: 'remove',
        path: `rows.${rowKey}.${col}`,
        prev: val,
        rowKey,
        column: col,
        source: 'local'
      });
    }
    dropRowFromSelectorCache(rowKey);
    diffBus.publish(diffs);
  };

  const renameRow = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;
    const s = getState();
    const prev = s.rows[oldKey];
    if (!prev || s.rows[newKey]) return;

    const nextRows = { ...s.rows } as RowsShape;
    delete nextRows[oldKey];
    nextRows[newKey] = { ...prev };
    setState({ rows: nextRows } as Partial<S>, false, 'rows/renameRow');

    // rename once across all columns
    indexStore.renameRow(oldKey, newKey);

    const diffs: FieldDiff[] = [];
    for (const [col] of Object.entries(prev)) {
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
    renameRowInSelectorCache(oldKey, newKey);
    diffBus.publish(diffs);
  };

  return { applyPatches, updateField, addRow, removeRow, renameRow };
}