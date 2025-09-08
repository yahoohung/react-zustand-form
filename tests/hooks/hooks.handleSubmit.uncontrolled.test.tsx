/** @jest-environment jsdom */
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { useForm } from '../../src/core/hooks';

function Demo({ onSubmit }: { onSubmit: (v: { name: string }) => void }) {
    const { Provider, register, handleSubmit } = useForm<{ name: string }>({
        defaultValues: { name: '' },
        name: 'demo',
        devtools: false,
    });

    return (
        <Provider>
            <form onSubmit={handleSubmit(onSubmit)}>
                <input data-testid="name" {...register('name', { uncontrolled: true })} />
                <button type="submit">ok</button>
            </form>
        </Provider>
    );
}

test('handleSubmit collects current DOM values (uncontrolled)', () => {
    const spy = jest.fn();
    render(<Demo onSubmit={spy} />);

    const input = screen.getByTestId('name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Ada' } });
    fireEvent.click(screen.getByText('ok'));

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ name: 'Ada' });
});
