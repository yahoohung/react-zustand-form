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
- `/#mega`
- `/#rhf-mega`
- `/#formik-mega`
- `/#perf-battle`
- `/#about`

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
  - `mega/App.tsx`: 10k+ fields with dirty (red border), changed (yellow fade), debounced validation, auto server updates, and blur-to-backend logging.
  - `rhf-mega/App.tsx`: Same UX as mega but built on react-hook-form for a side-by-side comparison.
  - `formik-mega/App.tsx`: Same UX again but built on Formik to compare ergonomics and perf.
  - `perf-battle/App.tsx`: One-stop page explaining the shared logic and quick links to switch across the three 10k demos.
  - `about/App.tsx`: Mirrors the repository README (imported as raw text via Vite), so it stays in sync without duplication.

Vite wiring

- `examples/package.json`: Contains dev/build scripts and local deps.
- `examples/index.html` + `examples/src/main.tsx`: App entry with a small hash switch.
- `examples/vite.config.ts`: Allows importing from `../../../src` so the examples use local source.

Deploy to Vercel (Option A)

- Repo root is the Vercel project root (examples import local `../../src`).
- `vercel.json` at repo root configures build and output.

Steps

- Import this repo in Vercel
- Vercel uses `vercel.json` automatically:
  - Build Command: `npm ci && npm run examples:install && npm run examples:build`
  - Output Directory: `examples/dist`
  - Framework: `vite`
  - Dev Command (optional): `npm run examples:dev`

> Note: These examples are not wired to a dev server here to keep devDeps lean. Copy one into your app to try it out.
