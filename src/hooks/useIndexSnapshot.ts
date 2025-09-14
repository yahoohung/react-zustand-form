// src/hooks/useIndexSnapshot.ts
import { useSyncExternalStore } from 'react';
export function createSnapshotStore(proxy: { snapshot: () => any; subscribe: (fn: () => void) => () => void }) {
    const get = () => proxy.snapshot();
    const sub = (cb: () => void) => proxy.subscribe(cb);
    return function useIndexSnapshot() {
        return useSyncExternalStore(sub, get, get);
    };
}