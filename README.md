# react-zustand-form

> **Concurrent-safe, user-first form state for React 18/19 — powered by Zustand selectors.**
> **Uncontrolled *or* controlled. High-frequency server sync. Field-level meta without rerenders.**

---

## Why react-zustand-form?

We love the React model and we rate RHF very highly — it solves most day-to-day forms.
But we also build screens where:

* values are **pushed from the backend every second** (think sockets, live prices, device telemetry);
* inputs must stay **user-first** (the server must not wrestle focus/value from the user);
* we keep **long-running `touched`/`dirty` statistics** and run **full-form validation** on each change;
* we need **field-level subscriptions** without re-rendering unrelated parts of the tree;
* we want a **vanilla store** that works outside React (DevTools, tests, workers) and is **Concurrent-safe**.

So we built **RZF** with a simple rule: keep React rendering calm; let a store do the heavy lifting.

---

## Highlights

* **User-first uncontrolled**: register as uncontrolled; we only mirror `dirty/touched` meta and read from the DOM on submit.
* **Server sync plugin**: coalesces patches and **only overwrites not-dirty fields** (policy-driven).
* **Concurrent-safe**: built on Zustand v5 (`useSyncExternalStore` under the hood); optional `startTransition` wrapping.
* **Granular subscriptions**: `subscribeWithSelector` keeps updates scoped to what matters.
* **Path-safe utils**: robust `parsePath/getAtPath/setAtPath` with prototype-pollution guards.
* **Typed, tiny, testable**: TypeScript first; purely functional core; no top-level side effects.

---

## Install

```bash
npm i react-zustand-form zustand
# peer deps: react ^18.2 || ^19, zustand ^5
```

---

## Quick start

### 1) Uncontrolled (user-first)

```tsx
import { useForm } from 'react-zustand-form';

type Values = { name: string };

export function Profile() {
  const { Provider, register, handleSubmit, formState } = useForm<Values>({
    name: 'profile',
    defaultValues: { name: '' },
    devtools: process.env.NODE_ENV !== 'production',
  });

  return (
    <Provider>
      <form
        onSubmit={handleSubmit((values) => {
          // values are read from DOM at submit time
          console.log(values);
        })}
      >
        <input {...register('name', { uncontrolled: true })} />
        {formState.touchedFields.name && formState.dirtyFields.name && (
          <span>Changed</span>
        )}
        <button>Save</button>
      </form>
    </Provider>
  );
}
```

### 2) Controlled (store-backed)

```tsx
const { Provider, register, formState } = useForm<Values>({
  name: 'profile',
  defaultValues: { name: '' },
});

<Provider>
  <input {...register('name')} />
  {formState.errors.name && <small>{formState.errors.name}</small>}
</Provider>;
```

### 3) Async resolver (validation)

```tsx
const { Provider, register } = useForm<Values>({
  defaultValues: { name: '' },
  resolver: async (values) => {
    if (!values.name) return { errors: { name: 'Name is required' } };
    return { errors: {} };
  },
});
```

### 4) Backend sync (client-only plugin)

```tsx
import { createBackendSync } from 'react-zustand-form/plugins/backend-sync';

const { Provider, register, store } = useForm<Values>({ defaultValues: { name: '' } });

// coalesce patches; only overwrite not-dirty fields (policy configurable)
const sync = createBackendSync(store, { coalesceMs: 16, policy: 'keepDirtyValues' });

// somewhere in your socket handler:
sync.pushServerPatch({ 'name': 'Alice' });
```


---

### 5) Hybrid: uncontrolled + backend (user-first) + Reset

```tsx
import * as React from 'react';
import {
  useForm,
  getAtPath, // exported path utils
} from 'react-zustand-form';
import { createBackendSync } from 'react-zustand-form/plugins/backend-sync';

type Values = {
  name: string;
  email: string;
  price: string; // keep as string for <input/>
};

export function LiveProfile() {
  const { Provider, register, handleSubmit, formState, store } = useForm<Values>({
    name: 'live-profile',
    defaultValues: { name: '', email: '', price: '' },
    devtools: process.env.NODE_ENV !== 'production',
    // optional: a resolver if you’d like live validation
    // resolver: async (v) => ({ errors: v.name ? {} : { name: 'Required' } }),
  });

  // 1) Attach backend-sync (client-only): coalesce; only overwrite NOT-dirty fields
  const sync = React.useMemo(
    () => createBackendSync(store, { coalesceMs: 150, policy: 'keepDirtyValues' }),
    [store]
  );

  // 2) Simulate high-frequency backend patches (e.g., sockets)
  React.useEffect(() => {
    const id = setInterval(() => {
      // backend pushes new price or name every second
      const price = String(Math.floor(Math.random() * 100));
      const nameMaybe = Math.random() < 0.3 ? `User ${Math.floor(Math.random() * 10)}` : undefined;

      const patch: Record<string, string> = { price };
      if (nameMaybe) patch['name'] = nameMaybe;

      sync.pushServerPatch(patch);
    }, 1000);
    return () => clearInterval(id);
  }, [sync]);

  // 3) Reset helpers: to 'defaults' OR to 'server' (latest flushed snapshot)
  const resetTo = React.useCallback((mode: 'defaults' | 'server') => {
    const s = store.getState();
    const refs = s.__domRefs ?? {};
    const source = mode === 'server' ? (s.serverState ?? {}) : s.__initial;

    for (const path of Object.keys(refs)) {
      const el = refs[path]?.current;
      if (!el) continue;
      const next = getAtPath(source as any, path);
      el.value = String(next ?? '');
    }

    // clear meta & errors
    store.setState(
      (st) => ({
        ...st,
        formState: { dirtyFields: {}, touchedFields: {}, errors: {} },
      }),
      false,
      { type: `reset:${mode}` }
    );
  }, [store]);

  return (
    <Provider>
      <form
        onSubmit={handleSubmit((values) => {
          // values are read from DOM at submit time (uncontrolled)
          alert(JSON.stringify(values, null, 2));
        })}
      >
        <label>
          Name
          <input {...register('name', { uncontrolled: true })} />
        </label>

        <label>
          Email
          <input {...register('email', { uncontrolled: true })} />
        </label>

        <label>
          Price (£)
          <input inputMode="numeric" {...register('price', { uncontrolled: true })} />
        </label>

        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button type="submit">Save</button>
          <button type="button" onClick={() => resetTo('defaults')}>Reset to defaults</button>
          <button type="button" onClick={() => resetTo('server')}>Reset to server</button>
        </div>

        <small style={{ display: 'block', marginTop: 8, opacity: 0.8 }}>
          Dirty: {JSON.stringify(formState.dirtyFields)} · Touched: {JSON.stringify(formState.touchedFields)}
        </small>
      </form>
    </Provider>
  );
}
```

**What this shows**

* Inputs are **uncontrolled** (`register(path, { uncontrolled: true })`).
* Backend pushes **frequently**; plugin coalesces and **won’t overwrite dirty fields**.
* Two reset modes:

  * **defaults** → set each input back to initial defaults.
  * **server** → set each input to the **latest server snapshot** the plugin flushed.
* Meta (`dirty/touched/errors`) is cleared on reset.

---

## API

### `useForm<T>(options)`

**Options**

| key             | type                                                                     | required | notes                                                                         |
| --------------- | ------------------------------------------------------------------------ | -------: | ----------------------------------------------------------------------------- |
| `name`          | `string`                                                                 |          | store name for DevTools                                                       |
| `defaultValues` | `T`                                                                      |        ✅ | initial snapshot; used for uncontrolled defaults and controlled initial value |
| `devtools`      | `boolean`                                                                |          | attach Zustand devtools in development only                                   |
| `resolver`      | `(values: T) => Promise<{errors?: FormErrors}> \| {errors?: FormErrors}` |          | async-friendly, epoch-cancelled                                               |

**Returns**

| key            | type                                                                                                               | notes                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `Provider`     | `React.FC`                                                                                                         | React context provider for the store                                                                                 |
| `register`     | `(path: string, opts?: {uncontrolled?: boolean}) => inputProps`                                                    | uncontrolled: returns `defaultValue`, `ref`, `onChange`, `onBlur`; controlled: returns `value`, `onChange`, `onBlur` |
| `handleSubmit` | `(fn: (values: T) => void) => (e?: FormEvent) => void`                                                             | collects uncontrolled values from DOM; controlled from store                                                         |
| `formState`    | `{ dirtyFields: Record<string, boolean>; touchedFields: Record<string, boolean>; errors: Record<string, string> }` | mirrored meta for UI                                                                                                 |
| `store`        | **vanilla** `FormStoreApi<T>`                                                                                      | `getState()`, `setState()`, `subscribe()` — useful for advanced patterns                                             |

> Controlled inputs trigger the resolver in a microtask after each change. Errors go to `formState.errors`; resolver exceptions are caught and placed under `_root`.

---

### Path utilities (exported)

> **Path syntax (MVP):** dot + **numeric brackets** only.
> Examples: `a.b[0].c`, `items[2]`, `map.0` (that’s a string key, not an index).
> **Quoted keys are not supported yet.** We block dangerous segments (`__proto__`, `constructor`, `prototype`) to prevent prototype-pollution.

```ts
import { parsePath, getAtPath, setAtPath } from 'react-zustand-form';

parsePath('a.b[0].c');           // ['a','b',0,'c']
getAtPath({ a: { b: [1] } }, 'a.b[0]'); // 1
setAtPath({}, 'foo[0].bar', 7);  // { foo: [{ bar: 7 }] } (immutable)
```

---

### Backend sync plugin (exported)

```ts
import { createBackendSync, type ResetPolicy } from 'react-zustand-form/plugins/backend-sync';

const sync = createBackendSync(store, {
  coalesceMs: 16,
  policy: 'keepDirtyValues' satisfies ResetPolicy,
});

sync.pushServerPatch({ 'rows.3.a': 12, 'name': 'Jane' });
sync.dispose();
```

* Coalesces patches; flushes after `coalesceMs`.
* Writes to store for observability and **conditionally** overwrites `input.value` for uncontrolled fields (policy-driven).
* Mark inputs dirty by typing: we won’t overwrite those unless `serverWins`.

---

### Advanced: `createFormStore(name, defaults, devtools)`

We export the vanilla store creator for power users (custom hooks, testing, workers).
Most apps won’t need this — `useForm` wraps it for you.

---

## Why not React Context?

Context is brilliant for config and low-frequency signals, but **every Provider value change can force consumers to re-render**. For high-frequency form updates and server patches, that’s wasteful. Zustand gives us:

* **Vanilla store** usable outside React;
* **Selector-based subscriptions** with equality checks;
* A `useSyncExternalStore`-compatible model for **Concurrent rendering**;
* **DevTools** and test-friendly ergonomics.

We still use a tiny Context internally — only to pass the store reference once.

---

## Why not react-hook-form?

RHF is an excellent library — use it when it fits. We reached for a different tool because our workloads required:

* **Live server-pushed values** coalesced into inputs **without stealing user input**;
* **Long-lived, field-level meta** (dirty/touched/errors) updated independently with minimal React work;
* A **vanilla store** that other systems can manipulate (without a React boundary);
* **Fine-grained subscriptions** and predictable equality rules;
* **Full-form validation** policies triggered on change/blur/submit with cancellation (epoch).

If your forms don’t have high-frequency external updates, **RHF is likely simpler**. If you do have them, RZF’s architecture keeps React calm while the store does the heavy lift.

---

## Security & stability

* **Prototype-pollution guards** on every path segment (`__proto__`, `constructor`, `prototype`).
* **No `dangerouslySetInnerHTML`**; plugin writes to `input.value` only.
* **Async safety**: resolver uses **epoch cancellation** + `try/catch`.
* **Batching**: merge-by-key with microtask flush; capped queue drops the oldest key.

---

## Testing

We ship with lightweight Jest tests and encourage additions.

### Local commands

```bash
# dev deps you’ll want:
npm i -D jest ts-jest @types/jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom

# run tests
npm test
```

### Jest tips

* Default environment: **node** (fast). For hooks/DOM tests, add at the top of the file:

  ```ts
  /** @jest-environment jsdom */
  ```
* Prefer `@testing-library/react`’s `act` / `waitFor` (avoid deprecated `react-dom/test-utils`).
* For fake timers, wrap `advanceTimersByTime` in `act`:

  ```ts
  import { act } from '@testing-library/react';
  await act(async () => {
    jest.advanceTimersByTime(20);
    await Promise.resolve();
  });
  ```

### What we test

* **Path utils**: parsing, safety, immutability.
* **Store**: core API, batcher semantics, devtools gating.
* **Hooks**: uncontrolled & controlled basics, resolver async behaviour.
* **Plugins**: not-dirty overwrite vs dirty preserve; policy override.

PRs with more tests are very welcome (see Contributing).

---

## Contributing

We welcome pull requests — small and focused is perfect.

* **Before you open a PR**:

  * Add/adjust tests; ensure `npm test` passes.
  * Run a quick size check if you add new deps.
  * Keep the core side-effect free; put browser-only features behind plugins.

* **Code style**: TypeScript, functional, no top-level effects. Prefer small modules.

* **Commit messages**: any sensible style is fine; we’ll squash on merge.

---

## FAQ

**Is this SSR/RSC-safe?**
The **core** is — no timers, no DOM at import. The **backend-sync plugin** is **client-only**.

**How big is it?**
Tiny core; no schema libs bundled. Tree-shakeable (no side effects).

**Can I use it with Zod/Yup?**
Yes — wire it in via `resolver`.

---

## Licence

MIT 

---

### At a glance

* 🚦 Uncontrolled (user-first) or controlled — you choose per field.
* ⚡ Coalesced server updates; DOM overwrite only when safe.
* 🧩 Zuständ-powered store with granular selectors.
* 🛡️ Safe path utils and async-robust resolver.
* 🧪 Friendly to tests; PRs welcome.
