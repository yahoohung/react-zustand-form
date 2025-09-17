import React from 'react';
// In your app use: import { useForm } from 'react-zustand-form'
import { useForm } from 'react-zustand-form';

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
        <h3 style={{ margin: '0 0 6px' }}>Controlled input (store-backed)</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li><b>What</b>: Input <code>value</code> is read from the store; updates write to the store.</li>
          <li><b>Why</b>: Needed when you must bind UI directly to state or run validation on every change.</li>
          <li><b>How</b>: Use <code>register(path)</code> without the uncontrolled flag; optional <code>resolver</code> sets <code>formState.errors</code>.</li>
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
