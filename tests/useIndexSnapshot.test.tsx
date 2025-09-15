/**
 * Tests for createSnapshotStore (useIndexSnapshot hook).
 * Simple UK English; proves re-render and unsubscribe behaviour.
 */
import React from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import { createSnapshotStore } from '../src/hooks/useIndexSnapshot';

afterEach(() => {
    cleanup();
});

function makeProxy() {
    let value = 0;
    const listeners = new Set<() => void>();
    return {
        get value() {
            return value;
        },
        set value(v: number) {
            value = v;
            listeners.forEach((l) => l());
        },
        proxy: {
            snapshot: () => value,
            subscribe: (cb: () => void) => {
                listeners.add(cb);
                return () => listeners.delete(cb);
            },
        },
        listeners,
    } as const;
}

/**
 * It should re-render when subscribe() fires.
 */
it('re-renders when value changes', async () => {
    const helper = makeProxy();
    const useSnap = createSnapshotStore(helper.proxy);

    function Demo() {
        const v = useSnap();
        return <div data-testid="v">{v}</div>;
    }

    render(<Demo />);
    expect(screen.getByTestId('v').textContent).toBe('0');

    // Trigger a change via the helper inside act
    await act(async () => {
        helper.value = 1;
    });
    expect(screen.getByTestId('v').textContent).toBe('1');
});

/**
 * It should unsubscribe on unmount.
 */
it('unsubscribes on unmount', () => {
    const { proxy, listeners } = makeProxy();
    const useSnap = createSnapshotStore(proxy);

    function Demo() {
        const v = useSnap();
        return <div data-testid="v">{v}</div>;
    }

    const { unmount } = render(<Demo />);
    expect(listeners.size).toBe(1);
    unmount();
    expect(listeners.size).toBe(0);
});

/**
 * It should call the unsubscribe function returned by subscribe().
 */
it('calls the unsubscribe function from subscribe', () => {
  const helper = makeProxy();
  const { proxy } = helper;
  let unsubCalled = false;

  const wrappedProxy = {
    snapshot: proxy.snapshot,
    subscribe: (cb: () => void) => {
      const unsub = proxy.subscribe(cb);
      return () => { unsub(); unsubCalled = true; };
    },
  };

  const useSnap = createSnapshotStore(wrappedProxy);

  function Demo() {
    useSnap();
    return <div>ok</div>;
  }

  const { unmount } = render(<Demo />);
  expect(unsubCalled).toBe(false);
  unmount();
  expect(unsubCalled).toBe(true);
});