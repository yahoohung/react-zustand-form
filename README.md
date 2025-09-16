# react-zustand-form

> **Concurrent-safe form state for React 18/19, powered by Zustand selectors.**
> **Works as uncontrolled or controlled. Handles fast server updates. Field meta without extra renders.**

---

## Why use react-zustand-form?

We like how React works and think react-hook-form (RHF) is great for most forms. But sometimes we need more:

* Values are **sent from the backend often** (for example, sockets, live prices, device data).
* Inputs must stay **user-first** (the server should not take over what the user is typing).
* We need to keep **`touched` and `dirty` status** for a long time and run **full validation** on every change.
* We want **field-level updates** without re-rendering the whole form.
* We want a **plain store** that works outside React (for DevTools, tests, workers) and is **safe for concurrent rendering**.

So we built **RZF** to keep React rendering simple and let the store do the work.

---

## Main features

* **User-first uncontrolled**: register fields as uncontrolled; we only track `dirty` and `touched`, and read values from the DOM on submit.
* **Server sync plugin**: merges updates and **only changes fields that are not dirty** (you can set the policy).
* **Concurrent-safe**: built on Zustand v5 (`useSyncExternalStore` inside); can use `startTransition` if you want.
* **Fine subscriptions**: `subscribeWithSelector` only updates what you need.
* **Safe path tools**: strong `parsePath`, `getAtPath`, `setAtPath` with protection against prototype pollution.
* **Typed, small, testable**: TypeScript first; functional core; no top-level side effects.

---

## Install

```bash
npm i react-zustand-form zustand
# peer dependencies: react ^18.2 or ^19, zustand ^5
```

---

## Examples (runnable)

- From the repo root:
  - Install: `npm run examples:install`
  - Dev server: `npm run examples:dev`
- In the browser, switch demos with the hash:
  - `/#uncontrolled`, `/#controlled`
  - `/#kernel` (ActionGate + column index)
  - `/#kernel-worker` (index offloaded to Web Worker)
  - `/#backend-sync` (debounce/coalesce/retry + keep-dirty server patches)
  - `/#validation` (resolver with Zod or AJV)
  - `/#perf` (large grid, e.g. 5k fields, FPS meter)

Example sources live under `examples/`.

What each demo shows

- `uncontrolled`: DOM-first inputs; library tracks `dirty`/`touched`; values read on submit.
- `controlled`: store-backed inputs; async `resolver` sets `formState.errors`.
- `kernel`: rows×columns data; fine-grained field selectors; column sum; highlight on updates; auto server feed; keep-dirty (server won't overwrite focused/edited cells) with a reset button.
- `kernel-worker`: same as kernel but column indexing offloaded to a Web Worker; reads indexes via `snapshot()`.
- `backend-sync`: batching/coalescing/retry of diffs; apply server patches with a keep-dirty policy.
- `validation`: shows `resolver` wired to Zod or AJV.
- `perf`: big grid (e.g. 100×50 = 5k fields) where only edited cells re-render; includes a simple FPS meter.

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
          // Values are read from the DOM when the form is submitted
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

### 3) Async validation (resolver)

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

// Merges updates; only changes fields that are not dirty (configurable)
const sync = createBackendSync(store, { coalesceMs: 16, policy: 'keepDirtyValues' });

// In your socket handler:
sync.pushServerPatch({ 'name': 'Alice' });
```

---

## API Overview

This package exposes two layers:

- App‑level hooks: `useForm` (un/controlled inputs, meta, async validation)
- Data‑layer kernel: `createFormKernel` (rows×columns state with action gate, diff bus, version map, and column index)

Below is the high‑level API surface with brief examples. Refer to source files for full typings.

### Kernel — `createFormKernel(initialRows, options)`

Creates the “killer feature” data kernel for large forms and table‑like data. It returns a small, consistent surface so field/row/column updates stay atomic and fast.

- Returns: `{ useStore, gate, diffBus, versionMap, indexStore }`
- `useStore`: Zustand store with `{ rows }`
- `gate`: ActionGate with atomic operations below
- `diffBus`: batched diff events for subscribers
- `versionMap`: per‑column version counters for tiered subscriptions
- `indexStore`: column index for fast lookups (can run in a Web Worker)

Options (subset):

- `index?: { whitelistColumns?: string[]; lazy?: boolean; lru?: { maxColumns: number } }`
- `offloadToWorker?: boolean` — run index in a Worker (read with `snapshot()`)
- `guardInDev?: boolean` — extra invariants in development (default true)

Example (60 seconds):

```ts
import { createFormKernel } from 'react-zustand-form';

const initial = {
  u1: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', score: 42 },
  u2: { firstName: 'Linus', lastName: 'Torvalds', email: 'linus@example.net', score: 11 },
};

const { useStore, gate, diffBus, versionMap, indexStore } = createFormKernel(initial, {
  index: { whitelistColumns: ['firstName', 'lastName', 'email', 'score'] },
});

// Read
const rows = useStore((s) => s.rows);

// Atomic updates (keeps index/version/diffs in sync)
gate.updateField('rows.u1.email', 'ada@new.co');
gate.addRow('u3', { firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.org', score: 77 });
gate.renameRow('u1', 'user1');
gate.removeRow('u2');
gate.applyPatches({ 'rows.user1.score': 45, 'rows.u3.email': 'grace@ex.org' });

// Column lookups
const emails = indexStore.getColumn('email').byRow; // { user1: '...', u3: '...' }

// Diffs (batched)
const unsubscribe = diffBus.subscribe((batch) => console.log('diffs', batch));
```

ActionGate methods:

- `applyPatches(map)`: batch server patches with light rebase
- `updateField(path, value)`: update a single cell
- `addRow(key, row)`: insert row
- `removeRow(key)`: delete row
- `renameRow(oldKey, newKey)`: rename row key

Worker offload:

- Pass `{ offloadToWorker: true }` to `createFormKernel`
- Read indexes via `indexStore.snapshot()` instead of `getColumn()`
- In custom setups, optionally set `globalThis.__WORKER_BASE_URL__` before creating the kernel if your bundler requires a base URL for the worker module

Selectors and subscriptions:

- `makeFieldSelector(rowKey, column)`: stable selector for a single cell
- `subscribeUiByColumn(versionMap, column, onTick)`: column‑level version ticks for UI
- `pullColumn(indexStore, column)`: fast access to a column’s row map

Types and helpers are re‑exported from the root: `core/action-gate`, `core/diff-bus`, `core/path-selectors`, `core/version-map`, `core/path`, `core/store`.

### Hook — `useForm<T>(options)`

React hook for simple forms with un/controlled inputs, meta (`dirty`/`touched`/`errors`) and async `resolver`.

- Returns: `{ Provider, register, handleSubmit, formState, store }`
- Uncontrolled via `register(path, { uncontrolled: true })`
- Controlled via `register(path)` (runs `resolver` after each change)

Options:

- `name?: string`, `defaultValues: T`, `devtools?: boolean`, `resolver?: (values) => Promise<{errors?: Record<string,string>}> | {errors?: ...}`

Example:

```tsx
const { Provider, register, handleSubmit, formState } = useForm<{ email: string }>({
  defaultValues: { email: '' },
  resolver: async (v) => ({ errors: /@/.test(v.email) ? {} : { email: 'Invalid email' } }),
});

<Provider>
  <input {...register('email')} />
  {formState.errors.email && <small>{formState.errors.email}</small>}
  <form onSubmit={handleSubmit(console.log)} />
</Provider>
```

### DiffBus — `createDiffBus(strategy)`

- Batches diffs, publishes per frame by default (`'animationFrame' | 'microtask' | 'idle'`)
- `{ publish(diff|diff[]), subscribe(cb), setStrategy(s), getStrategy() }`

### VersionMap — `createVersionMap()`

- Per‑column monotonic `version`; per‑row counters in `versionByRow`
- `{ ensureColumn(col), bump(col, rowKey|null), get(col), snapshot(), reset() }`

### Column Index — `createIndexStore(opts)` / worker proxy

- Methods: `{ getColumn(col), setCell(col,row,val), removeRow(key), renameRow(old,new), rebuildFromRows(rows), snapshot(), reset() }`
- Options: `{ whitelistColumns?, lazy?, lru? }`

### Path helpers — `parsePath`, `getAtPath`, `setAtPath`

- Safe, immutable path utilities with prototype‑pollution guards

---

### 5) Hybrid: uncontrolled + backend (user-first) + Reset

```tsx
import * as React from 'react';
import {
  useForm,
  getAtPath, // path tools
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
    // optional: add a resolver if you want live validation
    // resolver: async (v) => ({ errors: v.name ? {} : { name: 'Required' } }),
  });

  // 1) Attach backend sync (client only): merges; only changes fields that are not dirty
  const sync = React.useMemo(
    () => createBackendSync(store, { coalesceMs: 150, policy: 'keepDirtyValues' }),
    [store]
  );

  // 2) Simulate frequent backend updates (e.g. sockets)
  React.useEffect(() => {
    const id = setInterval(() => {
      // backend sends new price or name every second
      const price = String(Math.floor(Math.random() * 100));
      const nameMaybe = Math.random() < 0.3 ? `User ${Math.floor(Math.random() * 10)}` : undefined;

      const patch: Record<string, string> = { price };
      if (nameMaybe) patch['name'] = nameMaybe;

      sync.pushServerPatch(patch);
    }, 1000);
    return () => clearInterval(id);
  }, [sync]);

  // 3) Reset helpers: to 'defaults' OR to 'server' (latest server snapshot)
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
          // Values are read from the DOM when the form is submitted (uncontrolled)
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
* The backend sends updates often; the plugin merges them and **will not overwrite dirty fields**.
* Two reset options:
  * **defaults**: set each input back to the original values.
  * **server**: set each input to the **latest server snapshot**.
* The meta (`dirty`, `touched`, `errors`) is cleared on reset.

---

## API

### `useForm<T>(options)`

**Options**

| key             | type                                                                     | required | notes                                                                          |
| --------------- | ------------------------------------------------------------------------ | -------: | ------------------------------------------------------------------------------ |
| `name`          | `string`                                                                 |          | store name for DevTools                                                        |
| `defaultValues` | `T`                                                                      |        ✅ | initial values; used for uncontrolled and controlled fields                    |
| `devtools`      | `boolean`                                                                |          | use Zustand DevTools in development                                            |
| `resolver`      | `(values: T) => Promise<{errors?: FormErrors}> \| {errors?: FormErrors}` |          | async-friendly, cancels old calls                                              |

**Returns**

| key            | type                                                                                                               | notes                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `Provider`     | `React.FC`                                                                                                         | React context provider for the store                                                                                |
| `register`     | `(path: string, opts?: {uncontrolled?: boolean}) => inputProps`                                                    | uncontrolled: gives `defaultValue`, `ref`, `onChange`, `onBlur`; controlled: gives `value`, `onChange`, `onBlur`   |
| `handleSubmit` | `(fn: (values: T) => void) => (e?: FormEvent) => void`                                                             | collects uncontrolled values from DOM; controlled from store                                                        |
| `formState`    | `{ dirtyFields: Record<string, boolean>; touchedFields: Record<string, boolean>; errors: Record<string, string> }` | meta for UI                                                                                                         |
| `store`        | **plain** `FormStoreApi<T>`                                                                                       | `getState()`, `setState()`, `subscribe()` — useful for advanced patterns                                            |

> Controlled fields run the resolver in a microtask after each change. Errors go to `formState.errors`. Resolver exceptions are put under `_root`.

---

### Path tools (exported)

> **Path syntax:** dot and number brackets only.
> Examples: `a.b[0].c`, `items[2]`, `map.0` (string key, not index).
> **Quoted keys are not supported yet.** We block dangerous keys (`__proto__`, `constructor`, `prototype`) to prevent prototype pollution.

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

* Merges updates and sends them after `coalesceMs` milliseconds.
* Writes to the store for tracking and **can** change `input.value` for uncontrolled fields (depends on policy).
* If you type in a field, it is marked dirty and will not be overwritten unless you use `serverWins`.

---

### Advanced: `createFormStore(name, defaults, devtools)`

We export the plain store creator for advanced users (custom hooks, tests, workers).
Most apps do not need this. `useForm` wraps it for you.

---

## Why not React Context?

React Context is great for settings and low-frequency updates, but **every change in Provider value can cause re-renders**. For fast form updates and server patches, this is not efficient. Zustand gives:

* **Plain store** you can use outside React
* **Selector-based subscriptions** with equality checks
* A `useSyncExternalStore`-compatible model for **concurrent rendering**
* **DevTools** and good testing experience

We still use a small Context inside — only to pass the store once.

---

## Why not react-hook-form?

RHF is a great library — use it if it fits your needs. We needed something different because:

* We have **live values from the server** merged into inputs **without taking over user input**
* We want **field-level meta** (`dirty`, `touched`, `errors`) updated separately, with little React work
* We need a **plain store** other systems can use (even without React)
* We want **fine-grained subscriptions** and clear equality rules
* We want **full-form validation** on change/blur/submit, with cancellation

If your forms do not have fast external updates, **RHF is probably simpler**. If you do, RZF keeps React calm and lets the store do the work.

---

## Security and stability

* **Guards against prototype pollution** on every path segment (`__proto__`, `constructor`, `prototype`)
* **No `dangerouslySetInnerHTML`**; plugin only writes to `input.value`
* **Async safety**: resolver uses **cancellation** and `try/catch`
* **Batching**: merges by key with microtask flush; queue drops the oldest key if full

---

## Testing

We include lightweight Jest tests and welcome more.

### Local commands

```bash
# Development dependencies you will want:
npm i -D jest ts-jest @types/jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom

# Run tests
npm test
```

### Jest tips

* Default environment: **node** (fast). For hooks/DOM tests, add at the top of the file:

  ```ts
  /** @jest-environment jsdom */
  ```
* Prefer `@testing-library/react`’s `act` / `waitFor` (do not use deprecated `react-dom/test-utils`)
* For fake timers, wrap `advanceTimersByTime` in `act`:

  ```ts
  import { act } from '@testing-library/react';
  await act(async () => {
    jest.advanceTimersByTime(20);
    await Promise.resolve();
  });
  ```

### What we test

* **Path tools**: parsing, safety, immutability
* **Store**: core API, batching, devtools
* **Hooks**: uncontrolled & controlled basics, async resolver
* **Plugins**: overwriting not-dirty vs keeping dirty fields; policy override

Pull requests with more tests are very welcome (see Contributing).

---

## Contributing

Pull requests are welcome — small and focused is best.

* **Before you open a PR**:
  * Add or adjust tests; make sure `npm test` passes
  * Check the size if you add new dependencies
  * Keep the core free of side effects; put browser-only features in plugins

* **Code style**: TypeScript, functional, no top-level side effects. Prefer small modules.
* **Commit messages**: any clear style is fine; we squash on merge.

---

## FAQ

**Is this SSR/RSC-safe?**  
The **core** is — no timers, no DOM at import. The **backend-sync plugin** is **client-only**.

**How big is it?**  
The core is tiny; no schema libraries bundled. Tree-shakeable (no side effects).

**Can I use it with Zod/Yup?**  
Yes — connect them using `resolver`.

---

## Licence

MIT

---

### At a glance

* 🚦 Uncontrolled (user-first) or controlled — you choose for each field
* ⚡ Merges server updates; only changes the DOM when safe
* 🧩 Zustand-powered store with fine selectors
* 🛡️ Safe path tools and async-safe resolver
* 🧪 Easy to test; PRs welcome
