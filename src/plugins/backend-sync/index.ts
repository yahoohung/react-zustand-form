/**
 * Headless backend synchronisation engine.
 *
 * Watches local diffs from the diff bus and pushes them to a backend with
 * debounce, coalescing and optional retry logic. Also accepts server patches
 * and applies them through the ActionGate with a keep‑dirty policy.
 *
 */

import type { BackendSync, BackendSyncOptions, ServerPatch } from './types';
import type { DiffBus, FieldDiff } from '../../core/diff-bus';
import type { ActionGate } from '../../core/action-gate';
import type { VersionMap } from '../../core/version-map';
import type { IndexStore } from '../../index/column-index-store';

/**
 * Normalise the keep‑dirty configuration into a single object.
 *
 * @param opt  The keepDirtyValues option provided by the caller.
 * @returns    Object with `enabled` flag and a `shouldKeep` function when enabled.
 */
function normaliseKeepDirtyPolicy(opt?: BackendSyncOptions['keepDirtyValues']) {
  // No option provided -> disabled
  if (!opt) return { enabled: false } as const;
  // Boolean true -> enabled with default comparator
  if (opt === true) {
    return {
      enabled: true,
      shouldKeep: (_path: string, local: unknown, server: unknown) => Object.is(local, server) ? false : true
    } as const;
  }
  // Custom object -> enabled with user provided shouldKeep
  return { enabled: true, shouldKeep: opt.shouldKeep } as const;
}

/**
 * Create a backend synchronisation helper.
 *
 * Subscribes to a DiffBus and batches non‑server diffs for backend push.
 * Supports debounce, coalescing of same paths and retry with backoff.
 * Also provides a method to apply server patches with keep‑dirty logic.
 *
 * @param deps.diffBus     Source of local diffs.
 * @param deps.gate        ActionGate used to apply server patches.
 * @param deps.getState    Getter returning current rows for conflict checks.
 * @param deps.versionMap  Optional version map (reserved for future use).
 * @param deps.indexStore  Optional index store (reserved for future use).
 * @param options          Behaviour settings (push fn, debounce, retry etc.).
 * @returns                Public API to start/stop/flush and apply server patches.
 */
export function createBackendSync(
  deps: {
    diffBus: DiffBus;
    gate: ActionGate;
    getState: () => { rows: Record<string, Record<string, unknown>> };
    versionMap?: VersionMap;
    indexStore?: IndexStore;
  },
  options: BackendSyncOptions
): BackendSync {
  const {
    push,
    debounceMs = 48,
    coalesceSamePath = true,
    retry = { retries: 0, backoffMs: () => 0 },
    onPushStart, onPushSuccess, onPushError
  } = options;

  const keepDirty = normaliseKeepDirtyPolicy(options.keepDirtyValues);

  let started = false;
  let unsub: (() => void) | null = null;

  let pending: FieldDiff[] = [];
  let timer: any = null;
  let pushing = false;

  // Add a batch of diffs to the pending queue.
  // When coalescing, later diffs for the same path overwrite earlier ones.
  const enqueue = (batch: FieldDiff[]) => {
    if (coalesceSamePath) {
      const map = new Map<string, FieldDiff>();
      for (const d of pending) map.set(d.path, d);
      for (const d of batch) map.set(d.path, d);
      pending = Array.from(map.values());
    } else {
      pending.push(...batch);
    }
  };

  // Schedule a push after the debounce window.
  // If debounceMs <= 0, push immediately.
  const schedule = () => {
    if (debounceMs <= 0) {
      void pushNow();
      return;
    }
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      void pushNow();
    }, debounceMs);
  };

  // Attempt to push a batch with optional retry/backoff strategy.
  async function pushWithRetry(batch: FieldDiff[]) {
    let attempt = 0;
    onPushStart?.(batch);
    for (;;) {
      try {
        await push(batch);
        onPushSuccess?.(batch);
        return;
      } catch (e) {
        const willRetry = attempt < retry.retries;
        onPushError?.(batch, e, willRetry);
        if (!willRetry) throw e;
        const wait = retry.backoffMs(attempt);
        attempt += 1;
        if (wait > 0) await new Promise(r => setTimeout(r, wait));
      }
    }
  }

  // Flush the current pending diffs to the backend.
  // Resets pending list on success; re‑queues on failure.
  async function pushNow() {
    if (pushing) return;
    if (!pending.length) return;
    pushing = true;
    const batch = pending;
    pending = [];
    try {
      await pushWithRetry(batch);
    } catch {
      pending = [...batch, ...pending];
    } finally {
      pushing = false;
    }
  }

  // Begin listening to diffBus for outbound diffs.
  const start = () => {
    if (started) return;
    started = true;
    unsub = deps.diffBus.subscribe((batch) => {
      // filter server-sourced diffs to avoid echo
      const outbound = batch.filter(d => d.source !== 'server');
      if (!outbound.length) return;
      enqueue(outbound);
      schedule();
    });
  };

  // Stop listening and clear any timers.
  const stop = () => {
    if (!started) return;
    started = false;
    if (unsub) { unsub(); unsub = null; }
    if (timer) { clearTimeout(timer); timer = null; }
  };

  // Manually force an immediate push of all pending diffs.
  const flush = async () => {
    if (timer) { clearTimeout(timer); timer = null; }
    await pushNow();
  };

  // Apply a batch of server patches.
  // Uses keep‑dirty policy to decide whether to overwrite local values.
  const applyServerPatch = (patch: ServerPatch) => {
    const accepted: Record<string, unknown> = {};
    const state = deps.getState();
    for (const [path, serverValue] of Object.entries(patch.patches)) {
      if (!keepDirty.enabled) {
        accepted[path] = serverValue;
        continue;
      }
      const parts = path.split('.');
      if (parts[0] === 'rows' && parts.length >= 3) {
        const rowKey = parts[1];
        const column = parts.slice(2).join('.');
        const localValue = state.rows?.[rowKey]?.[column];
        const keep = keepDirty.shouldKeep(path, localValue, serverValue);
        if (!keep) accepted[path] = serverValue;
      } else {
        accepted[path] = serverValue;
      }
    }
    if (Object.keys(accepted).length) {
      deps.gate.applyPatches(accepted); // publish as source: 'server'
    }
  };

  // Stop the sync and clear all internal state.
  const dispose = () => {
    stop();
    pending = [];
  };

  return { start, stop, flush, dispose, applyServerPatch };
}