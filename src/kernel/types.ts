import type { FieldDiff } from '../core/diff-bus';

export type KernelRows = Record<string, Record<string, unknown>>;

export type KernelActionSource = 'local' | 'server';

export interface KernelCommit {
  rows: KernelRows;
  diffs: FieldDiff[];
  label: string;
  actionCount: number;
}
