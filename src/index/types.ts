// src/index/types.ts
export type MsgToWorker =
  | { kind: 'init'; opts?: unknown }
  | { kind: 'setCell'; col: string; rowKey: string; value: unknown }
  | { kind: 'removeRow'; rowKey: string }
  | { kind: 'renameRow'; oldKey: string; newKey: string }
  | { kind: 'reset' }
  | { kind: 'snapshot'; id: number };

export type MsgFromWorker =
  | { kind: 'snapshot'; id: number; data: Record<string, { byRow: Record<string, unknown> }> }
  | { kind: 'error'; id?: number; message: string };