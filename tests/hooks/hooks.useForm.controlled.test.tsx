/** @jest-environment jsdom */
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { useForm } from '../../src/hooks/useForm';

function Demo() {
    const { Provider, register, store } = useForm<{ name: string }>({
        defaultValues: { name: '' },
        name: 'demo',
        devtools: false,
    });

    // Controlled: register without { uncontrolled: true }
    const props = register('name');

    return (
        <Provider>
            <input data-testid="name" {...props} />
            {/* expose formState + value for assertions */}
            <pre data-testid="dirty">
                {JSON.stringify(store.getState().formState.dirtyFields)}
            </pre>
            <pre data-testid="value">
                {JSON.stringify((store.getState() as any).value ?? { name: '' })}
            </pre>
        </Provider>
    );
}

test('controlled register updates store.value and dirtyFields on change/blur', () => {
    render(<Demo />);
    const input = screen.getByTestId('name') as HTMLInputElement;

    // change
    fireEvent.change(input, { target: { value: 'Ada' } });

    const dirty = JSON.parse(screen.getByTestId('dirty').textContent || '{}');
    const value = JSON.parse(screen.getByTestId('value').textContent || '{}');
    expect(dirty.name).toBe(true);
    expect(value.name).toBe('Ada');

    // blur → touched (we won’t render touched in DOM here; just ensure no crash)
    fireEvent.blur(input);
});
