# Examples — useForm

This folder contains minimal examples showing how to use `useForm` from `react-zustand-form`.

Quick start (from repo root)

- Install example deps: `npm run examples:install`
- Dev server: `npm run examples:dev`
- Build: `npm run examples:build`
- Preview: `npm run examples:preview`

In the browser, switch between demos with the hash:

- `/#uncontrolled` (default)
- `/#controlled`
- `/#kernel`
- `/#kernel-worker`
- `/#backend-sync`
- `/#validation`
- `/#perf`

What / Why / How

- uncontrolled: simplest setup for forms.
  - Why: minimal React work and best typing UX.
  - How: register with `{ uncontrolled: true }`, values read on submit; meta tracked live.
- controlled: bind value to the store.
  - Why: when you need validation on every change.
  - How: `register('field')` and optional `resolver` for async errors.
- kernel: table-like state.
  - Why: atomic updates + fast column lookups + diffs.
  - How: use `gate.updateField/addRow/removeRow/renameRow`; read `indexStore.getColumn(col)`.
- kernel-worker: offload column indexing.
  - Why: keep UI responsive on bigger data.
  - How: pass `offloadToWorker: true`; read indexes via `snapshot()`.
- backend-sync: network orchestration.
  - Why: debounce/coalesce/retry pushes; apply server patches without clobbering user edits.
  - How: `createBackendSync`, `start/flush/stop`, `applyServerPatch`.

If you are consuming the library from npm, import like:

```ts
import { useForm } from 'react-zustand-form';
```

If you are developing in this repo and want to run the examples via your app, import from source:

```ts
import { useForm } from '../../src';
```

Structure

 - `useForm/`
   - `uncontrolled/App.tsx`: Quickest path using uncontrolled inputs (values read from DOM on submit). Tracks `dirty`/`touched` and supports async validation via `resolver`.
   - `controlled/App.tsx`: Simple controlled field bound through the store with async validation.
  - `kernel/App.tsx`: Table-like data with `createFormKernel`, atomic updates, diff bus and column index.
  - `kernel/worker/App.tsx`: Same as above, but with `offloadToWorker: true`; reads index via `snapshot()`.
  - `backend-sync/App.tsx`: Demonstrates `createBackendSync` (debounce/coalesce/retry, keep-dirty server patches).
  - `validation/App.tsx`: Shows `resolver` usage with Zod or AJV.
  - `perf/App.tsx`: Large grid (e.g., 5k fields) using field selectors; shows smooth updates and FPS meter.

Vite wiring

- `examples/package.json`: Contains dev/build scripts and local deps.
- `examples/index.html` + `examples/src/main.tsx`: App entry with a small hash switch.
- `examples/vite.config.ts`: Allows importing from `../../../src` so the examples use local source.

> Note: These examples are not wired to a dev server here to keep devDeps lean. Copy one into your app to try it out.
