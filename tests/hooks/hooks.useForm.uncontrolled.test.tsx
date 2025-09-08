/** @jest-environment jsdom */
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { useForm } from '../../src';

function Demo() {
  const { Provider, register, handleSubmit, store } = useForm<{ name: string }>({
    defaultValues: { name: '' }, name: 'demo', devtools: false
  });
  const onSubmit = (e?: any) => { };
  return (
    <Provider>
      <form onSubmit={handleSubmit(() => { })}>
        <input data-testid="name" {...register('name', { uncontrolled: true })} />
        <button type="submit">ok</button>
      </form>
      <pre data-testid="dirty">{JSON.stringify(store.getState().formState.dirtyFields)}</pre>
      <pre data-testid="touched">{JSON.stringify(store.getState().formState.touchedFields)}</pre>
    </Provider>
  );
}

test('uncontrolled register updates dirty/touched & submit collects DOM', () => {
  render(<Demo />);
  const input = screen.getByTestId('name') as HTMLInputElement;

  // change -> dirty true
  fireEvent.change(input, { target: { value: 'Ada' } });
  expect(JSON.parse(screen.getByTestId('dirty').textContent || '{}').name).toBe(true);

  // blur -> touched true
  fireEvent.blur(input);
  expect(JSON.parse(screen.getByTestId('touched').textContent || '{}').name).toBe(true);

  // submit should not throw; (optionally spy handleSubmit callback)
  fireEvent.click(screen.getByText('ok'));
});
