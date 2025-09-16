import React from 'react';
// In your app use: import { useForm } from 'react-zustand-form'
import { useForm } from '../../../src';

type Values = { name: string; email: string };

export default function UncontrolledExample() {
  const { Provider, register, handleSubmit, formState } = useForm<Values>({
    name: 'demo-uncontrolled',
    defaultValues: { name: '', email: '' },
    // Optional async validation
    resolver: async (v) => {
      const errors: Record<string, string> = {};
      if (!v.name) errors['name'] = 'Name is required';
      if (!v.email || !v.email.includes('@')) errors['email'] = 'Email looks invalid';
      return { errors };
    },
  });

  return (
    <Provider>
      <section style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 6px' }}>Uncontrolled inputs (user-first)</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li><b>What</b>: Minimal setup; inputs own their value, library tracks meta.</li>
          <li><b>Why</b>: Best UX for simple forms; least React re-renders.</li>
          <li><b>How</b>: <code>register(path, {'{'} uncontrolled: true {'}'})</code> adds defaultValue/ref/onChange/onBlur; values are read from the DOM on submit; async validation is supported via <code>resolver</code>.</li>
        </ul>
      </section>
      <form onSubmit={handleSubmit((values) => alert('submit ' + JSON.stringify(values)))}>
        <div>
          <label>
            Name
            <input {...register('name', { uncontrolled: true })} placeholder="Ada" />
          </label>
          {formState.errors['name'] && <small style={{ color: 'crimson' }}>{String(formState.errors['name'])}</small>}
        </div>

        <div>
          <label>
            Email
            <input {...register('email', { uncontrolled: true })} placeholder="ada@example.com" />
          </label>
          {formState.errors['email'] && <small style={{ color: 'crimson' }}>{String(formState.errors['email'])}</small>}
        </div>

        <button type="submit">Submit</button>
      </form>

      <pre>dirty: {JSON.stringify(formState.dirtyFields)}</pre>
      <pre>touched: {JSON.stringify(formState.touchedFields)}</pre>
    </Provider>
  );
}
