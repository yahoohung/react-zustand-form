import { selectorCache } from '../core/path-selectors';
import type { FieldDiff } from '../core/diff-bus';
import type { IndexStore } from '../index/column-index-store';
import { createIndexStore } from '../index/column-index-store';
import type { VersionMap } from '../core/version-map';
import { createVersionMap } from '../core/version-map';
import type { KernelCommit, KernelRows, KernelActionSource } from './types';

export type EngineAction =
  | { type: 'update-field'; path: string; next: unknown; source?: KernelActionSource }
  | { type: 'apply-patches'; patches: Record<string, unknown>; source?: KernelActionSource }
  | { type: 'add-row'; rowKey: string; row: Record<string, unknown>; source?: KernelActionSource }
  | { type: 'remove-row'; rowKey: string; source?: KernelActionSource }
  | { type: 'rename-row'; oldKey: string; newKey: string; source?: KernelActionSource };

export interface KernelEngineOptions {
  initialRows: KernelRows;
  indexStore?: IndexStore;
  versionMap?: VersionMap;
  sourceLabel?: string;
}

interface MutableContext {
  rows: KernelRows;
  rowsCloned: boolean;
  touchedRows: Map<string, Record<string, unknown>>;
}

interface ParsedPath {
  rowKey: string;
  column: string;
}

const BAD_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function parsePath(path: string): ParsedPath | null {
  if (!path.startsWith('rows.')) return null;
  const firstDot = path.indexOf('.', 5);
  if (firstDot === -1) return null;
  const rowKey = path.slice(5, firstDot);
  if (!rowKey || BAD_SEGMENTS.has(rowKey)) return null;
  const column = path.slice(firstDot + 1);
  if (!column) return null;
  if (column.includes('..')) return null;
  const segments = column.split('.');
  for (const seg of segments) {
    if (!seg || BAD_SEGMENTS.has(seg)) return null;
  }
  return { rowKey, column };
}

export interface KernelEngine {
  dispatch: (action: EngineAction) => void;
  getRows: () => KernelRows;
  flushNow: () => void;
}

export type CommitListener = (commit: KernelCommit) => void;

export function createKernelEngine(options: KernelEngineOptions, onCommit: CommitListener): KernelEngine {
  const versionMap = options.versionMap ?? createVersionMap();
  const indexStore = options.indexStore ?? createIndexStore();
  let currentRows: KernelRows = cloneRows(options.initialRows);
  let pending: EngineAction[] = [];
  let scheduled = false;

  const ensureScheduled = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(processQueue);
  };

  function processQueue() {
    scheduled = false;
    if (pending.length === 0) return;
    const actions = pending;
    pending = [];

    const ctx: MutableContext = {
      rows: currentRows,
      rowsCloned: false,
      touchedRows: new Map(),
    };

    const diffs: FieldDiff[] = [];

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i]!;
      switch (action.type) {
        case 'update-field':
          applyUpdate(ctx, action.path, action.next, action.source ?? 'local', diffs, indexStore, versionMap);
          break;
        case 'apply-patches':
          applyPatches(ctx, action.patches, action.source ?? 'server', diffs, indexStore, versionMap);
          break;
        case 'add-row':
          addRow(ctx, action.rowKey, action.row, action.source ?? 'local', diffs, indexStore, versionMap);
          break;
        case 'remove-row':
          removeRow(ctx, action.rowKey, action.source ?? 'local', diffs, indexStore, versionMap);
          break;
        case 'rename-row':
          renameRow(ctx, action.oldKey, action.newKey, action.source ?? 'local', diffs, indexStore, versionMap);
          break;
        default:
          break;
      }
    }

    if (ctx.rowsCloned) {
      currentRows = ctx.rows;
    }

    if (diffs.length > 0) {
      Object.freeze(currentRows);
      onCommit({ rows: currentRows, diffs, label: options.sourceLabel ?? 'kernel', actionCount: actions.length });
    }
  }

  return {
    dispatch(action) {
      pending.push(action);
      ensureScheduled();
    },
    getRows() {
      return currentRows;
    },
    flushNow() {
      if (scheduled) {
        processQueue();
      }
    }
  };
}

function cloneRows(rows: KernelRows): KernelRows {
  const clone: KernelRows = {};
  for (const key of Object.keys(rows)) {
    const row = rows[key];
    clone[key] = row ? { ...row } : {};
  }
  return clone;
}

function ensureRows(ctx: MutableContext): MutableContext {
  if (!ctx.rowsCloned) {
    ctx.rows = { ...ctx.rows };
    ctx.rowsCloned = true;
  }
  return ctx;
}

function ensureRow(ctx: MutableContext, rowKey: string): Record<string, unknown> {
  let row = ctx.rows[rowKey];
  if (!row) {
    ensureRows(ctx);
    row = {};
    ctx.rows[rowKey] = row;
    ctx.touchedRows.set(rowKey, row);
    return row;
  }
  if (!ctx.touchedRows.has(rowKey)) {
    ensureRows(ctx);
    const copy = { ...row };
    ctx.rows[rowKey] = copy;
    ctx.touchedRows.set(rowKey, copy);
    return copy;
  }
  return row;
}

function applyUpdate(
  ctx: MutableContext,
  path: string,
  value: unknown,
  source: KernelActionSource,
  diffs: FieldDiff[],
  indexStore: IndexStore,
  versionMap: VersionMap
) {
  const parsed = parsePath(path);
  if (!parsed) return;
  const { rowKey, column } = parsed;
  const currentRow = ctx.rows[rowKey];
  const prev = currentRow ? currentRow[column] : undefined;
  if (prev === value) return;
  const nextRow = ensureRow(ctx, rowKey);
  nextRow[column] = value;
  indexStore.setCell(column, rowKey, value);
  versionMap.bump(column, rowKey);
  diffs.push({
    kind: prev === undefined ? 'insert' : 'update',
    path,
    prev,
    next: value,
    rowKey,
    column,
    source,
  });
}

function applyPatches(
  ctx: MutableContext,
  patches: Record<string, unknown>,
  source: KernelActionSource,
  diffs: FieldDiff[],
  indexStore: IndexStore,
  versionMap: VersionMap
) {
  for (const [path, value] of Object.entries(patches)) {
    applyUpdate(ctx, path, value, source, diffs, indexStore, versionMap);
  }
}

function addRow(
  ctx: MutableContext,
  rowKey: string,
  row: Record<string, unknown>,
  source: KernelActionSource,
  diffs: FieldDiff[],
  indexStore: IndexStore,
  versionMap: VersionMap
) {
  if (ctx.rows[rowKey]) return;
  ensureRows(ctx);
  const copy = { ...row };
  ctx.rows[rowKey] = copy;
  ctx.touchedRows.set(rowKey, copy);
  selectorCache.dropRow(rowKey);
  for (const [column, value] of Object.entries(copy)) {
    indexStore.setCell(column, rowKey, value);
    versionMap.bump(column, rowKey);
    diffs.push({
      kind: 'insert',
      path: `rows.${rowKey}.${column}`,
      next: value,
      rowKey,
      column,
      source,
    });
  }
}

function removeRow(
  ctx: MutableContext,
  rowKey: string,
  source: KernelActionSource,
  diffs: FieldDiff[],
  indexStore: IndexStore,
  versionMap: VersionMap
) {
  const prev = ctx.rows[rowKey];
  if (!prev) return;
  ensureRows(ctx);
  delete ctx.rows[rowKey];
  ctx.touchedRows.delete(rowKey);
  selectorCache.dropRow(rowKey);
  indexStore.removeRow(rowKey);
  versionMap.dropRow(rowKey);
  const entries = Object.entries(prev);
  for (let i = 0; i < entries.length; i++) {
    const [column, value] = entries[i]!;
    versionMap.bump(column, null);
    diffs.push({
      kind: 'remove',
      path: `rows.${rowKey}.${column}`,
      prev: value,
      rowKey,
      column,
      source,
    });
  }
}

function renameRow(
  ctx: MutableContext,
  oldKey: string,
  newKey: string,
  source: KernelActionSource,
  diffs: FieldDiff[],
  indexStore: IndexStore,
  versionMap: VersionMap
) {
  if (oldKey === newKey) return;
  const prev = ctx.rows[oldKey];
  if (!prev) return;
  if (ctx.rows[newKey]) return;
  ensureRows(ctx);
  const clone = { ...prev };
  delete ctx.rows[oldKey];
  ctx.rows[newKey] = clone;
  ctx.touchedRows.delete(oldKey);
  ctx.touchedRows.set(newKey, clone);
  selectorCache.renameRow(oldKey, newKey);
  indexStore.renameRow(oldKey, newKey);
  versionMap.renameRow(oldKey, newKey);
  const columns = Object.keys(clone);
  for (let i = 0; i < columns.length; i++) {
    const column = columns[i]!;
    versionMap.bump(column, newKey);
    diffs.push({
      kind: 'rename',
      path: `rows.${newKey}.${column}`,
      prev: oldKey,
      next: newKey,
      rowKey: newKey,
      column,
      source,
    });
  }
}
