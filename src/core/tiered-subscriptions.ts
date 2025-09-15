/**
 * Tiered subscription helpers for the diff/selector system.
 *
 * Compute tier: listen to raw diffs before any coalescing.
 * UI tier: listen to column version changes for efficient re-render.
 */
import type { DiffBus, FieldDiff } from './diff-bus';
import type { VersionMap } from './version-map';
import type { IndexStore } from '../index/column-index-store';

/**
 * Subscribe to raw diff batches directly from the diff bus.
 * Emits every batch before any filtering or coalescing.
 *
 * @param bus      DiffBus instance to listen on.
 * @param listener Callback that receives each batch of diffs.
 * @returns        Unsubscribe function.
 */
export function subscribeCompute(bus: DiffBus, listener: (batch: FieldDiff[]) => void) {
  return bus.subscribe(listener);
}

/** Shared frozen empty record to avoid new allocations when a column is missing. */
const EMPTY_NUM_RECORD: Record<string, number> = Object.freeze({});

/**
 * Subscribe to version changes for a single column.
 * Call the returned `check()` inside a store subscription to emit when the version changes.
 *
 * Performance notes:
 * - Uses 0 as a missing version for cheap comparison.
 * - No deep cloning; the returned `versionByRow` is a live reference. Do not mutate.
 *
 * @param versionMap VersionMap providing version counters.
 * @param column     Column key to watch.
 * @param onTick     Called when the version changes.
 * @param opts       Optional flags. `reuseEnvelope` keeps a single object to reduce allocations.
 * @returns          An object with a `check()` method to call on each store tick.
 */
export function subscribeUiByColumn(
  versionMap: VersionMap,
  column: string,
  onTick: (info: { version: number; versionByRow: Record<string, number> }) => void,
  opts?: { reuseEnvelope?: boolean }
) {
  // Use 0 as the "not-present" version to keep comparisons cheap.
  let prevVersion = versionMap.get(column)?.version ?? 0;
  const reuse = !!opts?.reuseEnvelope;
  // Optional reusable envelope to avoid allocating a new object on each tick.
  const envelope = reuse ? ({ version: 0, versionByRow: EMPTY_NUM_RECORD as Record<string, number> }) : null;
  return {
    check: () => {
      const v = versionMap.get(column);
      if (!v) {
        if (prevVersion !== 0) {
          prevVersion = 0;
          if (reuse && envelope) {
            envelope.version = 0;
            envelope.versionByRow = EMPTY_NUM_RECORD;
            onTick(envelope);
          } else {
            onTick({ version: 0, versionByRow: EMPTY_NUM_RECORD });
          }
        }
        return;
      }
      if (v.version !== prevVersion) {
        prevVersion = v.version;
        // Pass through the reference to avoid copying large objects; caller must not mutate.
        if (reuse && envelope) {
          envelope.version = v.version;
          envelope.versionByRow = v.versionByRow;
          onTick(envelope);
        } else {
          onTick({ version: v.version, versionByRow: v.versionByRow });
        }
      }
    }
  };
}

/**
 * Fetch the latest row map for a given column.
 * Fast path: returns a live reference from the index store. Do not mutate.
 *
 * @param indexStore IndexStore to read from.
 * @param column     Column key to pull.
 * @returns          Map of rowKey to cell value for the column.
 */
export function pullColumn(indexStore: IndexStore, column: string) {
  // Fast path: return reference without cloning.
  return indexStore.getColumn(column).byRow;
}