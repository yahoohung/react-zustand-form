/** @jest-environment jsdom */
import React, { act } from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { useForm } from '../../src/core/hooks';
import { createBackendSync, type ResetPolicy } from '../../src/plugins/backend-sync';

// helper to advance coalesce timers deterministically
const flushTimers = async (ms = 20) => {
    await act(async () => {
        jest.advanceTimersByTime(ms);
        await Promise.resolve();
    });
};
beforeAll(() => {
    jest.useFakeTimers();
});
afterAll(() => {
    jest.useRealTimers();
});

// ✅ Explicit prop typing avoids literal narrowing
function Demo(props: { policy?: ResetPolicy }) {
    const { Provider, register, store } = useForm<{ name: string }>({
        defaultValues: { name: '' },
        name: 'demo',
        devtools: false,
    });

    const policy: ResetPolicy = props.policy ?? 'keepDirtyValues';

    // attach plugin
    const sync = React.useMemo(
        () => createBackendSync(store, { coalesceMs: 10, policy }),
        [store, policy]
    );

    // expose a way to push from test
    (globalThis as any).__push = (patch: Record<string, any>) => sync.pushServerPatch(patch);

    return (
        <Provider>
            <input data-testid="name" {...register('name', { uncontrolled: true })} />
        </Provider>
    );
}

test('not-dirty field is overwritten by server patch after coalesce', async () => {
    render(<Demo policy="keepDirtyValues" />);
    const input = screen.getByTestId('name') as HTMLInputElement;

    expect(input.value).toBe('');
    (globalThis as any).__push({ name: 'Alice' });

    await flushTimers();
    expect(input.value).toBe('Alice');
});

test('dirty field is preserved (keepDirtyValues)', async () => {
    render(<Demo policy="keepDirtyValues" />);
    const input = screen.getByTestId('name') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'Bob' } }); // mark dirty
    (globalThis as any).__push({ name: 'Carol' });

    await flushTimers();
    expect(input.value).toBe('Bob'); // preserved because dirty
});

test('serverWins policy overwrites even if dirty', async () => {
    render(<Demo policy="serverWins" />);
    const input = screen.getByTestId('name') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'Bob' } }); // dirty
    (globalThis as any).__push({ name: 'Carol' });

    await flushTimers();
    expect(input.value).toBe('Carol'); // serverWins → overwrite
});
