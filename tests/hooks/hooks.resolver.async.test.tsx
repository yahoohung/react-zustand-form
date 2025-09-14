/** @jest-environment jsdom */
import React, { act } from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { useForm } from '../../src/hooks/useForm';
import type { FormErrors } from '../../src/core/types';

function Demo() {
    const resolverImpl = async (values: { name: string }): Promise<{ errors?: FormErrors }> => {
        await new Promise((r) => setTimeout(r, values.name === 'SLOW' ? 20 : 5));
        if (values.name === 'ERR') throw new Error('boom');
        return values.name ? { errors: {} } : { errors: { name: 'required' } };
    };

    const resolver: (v: { name: string }) => Promise<{ errors?: FormErrors }> =
        jest.fn(resolverImpl);

    const { Provider, register, store } = useForm<{ name: string }>({
        defaultValues: { name: '' },
        name: 'demo',
        devtools: false,
        resolver,
    });

    const props = register('name'); 

    return (
        <Provider>
            <input data-testid="name" {...props} />
            <pre data-testid="errors">{JSON.stringify(store.getState().formState.errors)}</pre>
        </Provider>
    );
}

beforeAll(() => jest.useFakeTimers());
afterAll(() => jest.useRealTimers());

const tickAll = async (ms = 30) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    await Promise.resolve();
  });
};

test('resolver success clears errors; latest result wins (epoch cancellation)', async () => {
    render(<Demo />);
    const input = screen.getByTestId('name') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'SLOW' } });
    fireEvent.change(input, { target: { value: 'OK' } });

    await tickAll(50);
    const errors = JSON.parse(screen.getByTestId('errors').textContent || '{}');
    expect(errors).toEqual({});
});

test('resolver error is captured into formState.errors', async () => {
    render(<Demo />);
    const input = screen.getByTestId('name') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'ERR' } });
    await tickAll(50);

    const errors = JSON.parse(screen.getByTestId('errors').textContent || '{}');
    expect(Object.keys(errors).length).toBe(1);
    expect(String(errors._root || '')).toContain('boom');
});
