// Portions adapted from react-sweet-state (MIT License)
import { useCallback, useRef, useSyncExternalStore } from 'react';
import { unstable_batchedUpdates } from 'react-dom';

type Listener<T> = (state: T) => void;

export type EqualityFn<T> = (prev: T, next: T) => boolean;

export interface UseSweetStoreHook<T> {
  <U>(selector?: (state: T) => U, equalityFn?: EqualityFn<U>): U;
  getState: () => T;
  setState: SweetStoreApi<T>['setState'];
  subscribe: SweetStoreApi<T>['subscribe'];
}

export interface SweetStoreOptions {
  name?: string;
  devtools?: boolean;
}

export interface SweetStoreApi<T> {
  useStore: UseSweetStoreHook<T>;
  getState: () => T;
  setState: (
    updater: T | ((state: T) => T),
    replace?: boolean,
    action?: { type: string }
  ) => void;
  subscribe: (listener: Listener<T>) => () => void;
}

const isFunction = (value: unknown): value is Function => typeof value === 'function';
const identity = <T>(value: T) => value;


function getDevtools<T>(name: string, initialState: T) {
  if (typeof window === 'undefined') return null;
  const extension = (window as any).__REDUX_DEVTOOLS_EXTENSION__;
  if (!extension) return null;
  try {
    const connection = extension.connect({ name, serialize: true, trace: true });
    connection.init(initialState);
    return connection;
  } catch {
    return null;
  }
}

export function createSweetStore<T>(initialState: T, options: SweetStoreOptions = {}): SweetStoreApi<T> {
  let state = initialState;
  const listeners = new Set<Listener<T>>();
  const name = options.name ?? 'sweet-store';
  const devtools = options.devtools ? getDevtools(name, state) : null;

  const notify = () => {
    const snapshot = state;
    unstable_batchedUpdates(() => {
      listeners.forEach((listener) => {
        try {
          listener(snapshot);
        } catch {
          // Listener errors are swallowed to keep other subscribers notified.
        }
      });
    });
  };

  const applyState = (nextState: T, actionLabel?: string, fromDevtools = false) => {
    if (Object.is(state, nextState)) return;
    state = nextState;
    if (devtools && !fromDevtools) {
      try {
        devtools.send({ type: actionLabel ?? 'setState', payload: state }, state);
      } catch {
        // Ignore devtools errors to avoid breaking user code.
      }
    }
    notify();
  };

  if (devtools) {
    try {
      devtools.subscribe((message: any) => {
        if (message.type === 'DISPATCH') {
          const payloadType = message.payload?.type;
          switch (payloadType) {
            case 'RESET':
              applyState(initialState, 'devtools/reset', true);
              devtools.init(state);
              return;
            case 'COMMIT':
              devtools.init(state);
              return;
            case 'ROLLBACK':
              if (typeof message.state === 'string') {
                try {
                  const parsed = JSON.parse(message.state) as T;
                  applyState(parsed, 'devtools/rollback', true);
                } catch {
                  // ignore malformed JSON from the devtools extension
                }
              }
              devtools.init(state);
              return;
            case 'JUMP_TO_STATE':
            case 'JUMP_TO_ACTION':
              if (typeof message.state === 'string') {
                try {
                  const parsed = JSON.parse(message.state) as T;
                  applyState(parsed, 'devtools/jump', true);
                } catch {
                  // ignore malformed JSON from the devtools extension
                }
              }
              return;
            default:
              return;
          }
        }
        if (message.type === 'ACTION' && typeof message.payload === 'string') {
          try {
            const payload = JSON.parse(message.payload) as { payload: T };
            if (payload && 'payload' in payload) {
              applyState(payload.payload, 'devtools/action', true);
            }
          } catch {
            // ignore malformed payloads
          }
        }
      });
    } catch {
      // ignore devtools subscription errors
    }
  }

  const getState = () => state;

  const subscribe = (listener: Listener<T>) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const setState = (
    updater: T | ((current: T) => T),
    replace = false,
    action?: { type: string }
  ) => {
    const current = state;
    const prepared = isFunction(updater)
      ? (updater as (current: T) => T)(current)
      : (updater as T);
    const shouldMerge = (
      !replace &&
      typeof current === 'object' &&
      current !== null &&
      typeof prepared === 'object' &&
      prepared !== null &&
      !Array.isArray(current) &&
      !Array.isArray(prepared)
    );
    const nextState = shouldMerge
      ? ({ ...(current as Record<string, unknown>), ...(prepared as Record<string, unknown>) } as unknown as T)
      : (prepared as T);
    const label = action?.type;
    applyState(nextState, label);
  };

  const useStore: UseSweetStoreHook<T> = function useSweetStore<U>(
    selector: (state: T) => U = identity as unknown as (state: T) => U,
    equalityFn: EqualityFn<U> = Object.is
  ): U {
    const selectorRef = useRef(selector);
    selectorRef.current = selector;
    const equalityRef = useRef(equalityFn);
    equalityRef.current = equalityFn;

    const getSnapshot = useCallback(() => selectorRef.current(getState()), []);

    const subscribeWithSelector = useCallback(
      (onStoreChange: () => void) => {
        let currentSlice = selectorRef.current(getState());
        return subscribe((nextState) => {
          const nextSlice = selectorRef.current(nextState);
          if (!equalityRef.current(currentSlice, nextSlice)) {
            currentSlice = nextSlice;
            onStoreChange();
          }
        });
      },
      []
    );

    return useSyncExternalStore(subscribeWithSelector, getSnapshot, getSnapshot);
  } as UseSweetStoreHook<T>;

  useStore.getState = getState;
  useStore.setState = setState;
  useStore.subscribe = subscribe;

  return {
    useStore,
    getState,
    setState,
    subscribe,
  };
}
