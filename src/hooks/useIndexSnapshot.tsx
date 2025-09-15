/**
 * React hook factory to read a live snapshot from a custom store.
 *
 * Wraps `useSyncExternalStore` to provide a stable subscription to an object
 * that exposes `snapshot()` and `subscribe()` methods.
 */
import { useSyncExternalStore } from 'react';
/**
 * Create a React hook bound to a snapshot-producing proxy.
 *
 * @param proxy An object with:
 *   - `snapshot`: returns the current snapshot value.
 *   - `subscribe`: registers a callback to run when the snapshot may have changed.
 * @returns A React hook (`useIndexSnapshot`) that returns the latest snapshot
 *          and re-renders when it changes.
 */
export function createSnapshotStore(proxy: { snapshot: () => any; subscribe: (fn: () => void) => () => void }) {
    const get = () => proxy.snapshot();
    const sub = (cb: () => void) => proxy.subscribe(cb);
    // The actual React hook that components will call.
    return function useIndexSnapshot() {
        return useSyncExternalStore(sub, get, get);
    };
}