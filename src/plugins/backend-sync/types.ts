/**
 * Type definitions for the headless backend sync engine.
 *
 * Provides all option and API shapes used by createBackendSync.
 * Pure types, no runtime logic.
 */
import type { FieldDiff } from '../../core/diff-bus';

/**
 * Function that sends a batch of diffs to the backend.
 * Must return a Promise that resolves when the push is complete.
 */
export type PushBatch = (batch: FieldDiff[]) => Promise<void>;

/**
 * Settings for retrying a failed push.
 * - retries: maximum number of attempts.
 * - backoffMs: function that returns the wait time before each attempt.
 */
export interface RetryPolicy {
  retries: number;
  backoffMs: (attempt: number) => number;
}

/**
 * Rule for deciding if a server value should overwrite a local value.
 * Return true from shouldKeep when the local value must be kept.
 */
export interface KeepDirtyValuesPolicy {
  shouldKeep: (path: string, localValue: unknown, serverValue: unknown) => boolean;
}

/**
 * Options used when creating a backend sync instance.
 * - push: required function to send diffs.
 * - debounceMs: optional wait time before pushing.
 * - coalesceSamePath: if true, merge diffs on the same path.
 * - keepDirtyValues: policy to protect user edits.
 * - retry: optional retry settings.
 * - onPushStart/onPushSuccess/onPushError: optional lifecycle callbacks.
 */
export interface BackendSyncOptions {
  push: PushBatch;
  debounceMs?: number;
  coalesceSamePath?: boolean;
  keepDirtyValues?: KeepDirtyValuesPolicy | boolean;
  retry?: RetryPolicy;
  onPushStart?: (batch: ReadonlyArray<Readonly<FieldDiff>>) => void;
  onPushSuccess?: (batch: ReadonlyArray<Readonly<FieldDiff>>) => void;
  onPushError?: (batch: ReadonlyArray<Readonly<FieldDiff>>, error: unknown, willRetry: boolean) => void;
}

/**
 * A patch coming from the server.
 * Contains a record of path -> value pairs.
 */
export interface ServerPatch {
  patches: Record<string, unknown>;
}

/**
 * Public API returned by createBackendSync.
 * - start: begin listening for local diffs.
 * - stop: stop listening.
 * - flush: push all pending diffs now.
 * - dispose: clean up internal state.
 * - applyServerPatch: apply a server patch with keep-dirty logic.
 */
export interface BackendSync {
  start: () => void;
  stop: () => void;
  flush: () => Promise<void>;
  dispose: () => void;
  applyServerPatch: (patch: ServerPatch) => void;
}