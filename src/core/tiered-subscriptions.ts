import type { DiffBus, FieldDiff } from './diff-bus';
import type { VersionMap } from './version-map';
import type { IndexStore } from '../index/index-store';

/** Compute-tier: subscribe raw diffs (pre-coalesce semantics). */
export function subscribeCompute(bus: DiffBus, listener: (batch: FieldDiff[]) => void) {
  return bus.subscribe(listener);
}

// Shared empty record to avoid reallocations when a column is missing.
const EMPTY_NUM_RECORD: Record<string, number> = Object.freeze({});

/**
 * UI-tier: subscribe by column version; call .check() inside store subscription callback.
 * Performance notes:
 * - No cloning of versionByRow (pass by reference). DO NOT mutate the object you receive.
 * - Minimal allocations; only emit when version actually changes.
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

/** Helper: pull latest column map when UI tick comes. */
export function pullColumn(indexStore: IndexStore, column: string) {
  // Fast path: return reference without cloning.
  return indexStore.getColumn(column).byRow;
}