/**
 * Create a React hook bound to a snapshot-producing proxy.
 *
 * @param proxy An object with:
 *   - `snapshot`: returns the current snapshot value.
 *   - `subscribe`: registers a callback to run when the snapshot may have changed.
 * @returns A React hook (`useIndexSnapshot`) that returns the latest snapshot
 *          and re-renders when it changes.
 */
declare function createSnapshotStore(proxy: {
    snapshot: () => any;
    subscribe: (fn: () => void) => () => void;
}): () => any;

export { createSnapshotStore };
