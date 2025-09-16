import React from 'react';
// In your app: import { useForm } from 'react-zustand-form'
import { useForm } from '../../src';
import { z } from 'zod';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

type Values = { name: string; email: string };

const zodSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Please enter a valid email'),
});

function makeZodResolver() {
  return async (values: Values) => {
    const r = zodSchema.safeParse(values);
    if (r.success) return { errors: {} };
    const errors: Record<string, string> = {};
    for (const issue of r.error.issues) {
      const path = issue.path.join('.') || '_root';
      errors[path] = issue.message;
    }
    return { errors };
  };
}

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const ajvValidate = ajv.compile({
  type: 'object',
  required: ['name', 'email'],
  properties: {
    name: { type: 'string', minLength: 1 },
    email: { type: 'string', format: 'email' },
  },
});

function makeAjvResolver() {
  return async (values: Values) => {
    const ok = ajvValidate(values as any);
    if (ok) return { errors: {} };
    const errors: Record<string, string> = {};
    for (const e of ajvValidate.errors || []) {
      // instancePath like "/email" -> "email"
      const path = (e.instancePath || '').replace(/^\//, '').replace(/\//g, '.') || String(e.params?.missingProperty || '_root');
      const msg = e.message || 'Invalid value';
      errors[path] = msg;
    }
    return { errors };
  };
}

export default function ValidationExample() {
  const [engine, setEngine] = React.useState<'zod' | 'ajv'>('zod');
  const resolver = React.useMemo(() => (engine === 'zod' ? makeZodResolver() : makeAjvResolver()), [engine]);

  const { Provider, register, formState } = useForm<Values>({
    name: 'demo-validation',
    defaultValues: { name: '', email: '' },
    resolver,
  });

  return (
    <Provider>
      <section style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 6px' }}>Validation with Zod or AJV</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li><b>What</b>: Use your favourite schema library through the <code>resolver</code>.</li>
          <li><b>Why</b>: Centralised, testable validation with friendly error messages.</li>
          <li><b>How</b>: Return an object like <code>errors: Record&lt;string, string&gt;</code> from the resolver. Controlled fields trigger it on change.</li>
        </ul>
      </section>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
        <label style={{ margin: 0 }}>
          Engine
          <select value={engine} onChange={(e) => setEngine(e.currentTarget.value as 'zod' | 'ajv')} style={{ marginLeft: 8 }}>
            <option value="zod">Zod</option>
            <option value="ajv">AJV</option>
          </select>
        </label>
      </div>

      <label>
        Name
        <input {...register('name')} placeholder="Ada" />
      </label>
      {formState.errors['name'] && <small style={{ color: 'crimson' }}>{String(formState.errors['name'])}</small>}

      <label>
        Email
        <input {...register('email')} placeholder="ada@example.com" />
      </label>
      {formState.errors['email'] && <small style={{ color: 'crimson' }}>{String(formState.errors['email'])}</small>}
    </Provider>
  );
}
