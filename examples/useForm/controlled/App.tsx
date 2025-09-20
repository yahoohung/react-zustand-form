import React from 'react';
// In your app use: import { useForm } from 'rezend-form'
import { useForm } from '../../../src';

type Values = { email: string };

export default function ControlledExample() {
  const { Provider, register, formState } = useForm<Values>({
    name: 'demo-controlled',
    defaultValues: { email: '' },
    resolver: async (v) => ({
      errors: !v.email || !v.email.includes('@') ? { email: 'Please enter a valid email' } : {},
    }),
  });

  return (
    <Provider>
      <section style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 6px' }}>Controlled input (store drives the value)</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li><b>What</b>: The field reads and writes through the store, so React state is always the source of truth.</li>
          <li><b>Why</b>: Use this pattern when you need validation on every keystroke or want to react to value changes instantly.</li>
          <li><b>How</b>: Call <code>register(path)</code> without the uncontrolled flag; the optional <code>resolver</code> fills <code>formState.errors</code> as you type.</li>
        </ul>
      </section>
      <label>
        Email
        <input {...register('email')} placeholder="Email" />
      </label>
      {formState.errors['email'] && <small style={{ color: 'crimson' }}>{String(formState.errors['email'])}</small>}
    </Provider>
  );
}
