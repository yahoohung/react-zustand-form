# Examples playground

This directory hosts the demo app that lives at `/examples`. Each screen highlights a different slice of `rezend-form`, so you can copy patterns straight into your project.

## Try it locally

From the repo root:

1. `npm run examples:install`
2. `npm run examples:dev`
3. Open the URL that Vite prints (default `http://localhost:5173`)

Need a production build? Use `npm run examples:build` and preview it with `npm run examples:preview`.

## Navigating the demos

Switch demos by changing the hash part of the URL (`/#demo-name`). The navigation bar lists them all, but here’s the quick map:

- `/#uncontrolled` – minimal form using uncontrolled inputs.
- `/#controlled` – store-backed field with instant validation.
- `/#kernel` – table-style form state with indexing and diffs.
- `/#kernel-worker` – same kernel but with indexing offloaded to a worker.
- `/#backend-sync` – diff bus demo using `createBackendSync` to batch pushes and apply server patches.
- `/#sudoku` – 9×9 Sudoku showcasing field/row/column subscriptions.
- `/#2048` – the 2048 puzzle with kernel-powered moves, row summaries, and column watchers.
- `/#validation` – `resolver` wired to either Zod or AJV.
- `/#perf` – 5k-field grid showcasing selector performance.
- `/#mega`, `/#rhf-mega`, `/#formik-mega` – side-by-side 10k-field stress tests.
- `/#sweet-state-mega` – 10k-field stress test backed by react-sweet-state.
- `/#perf-battle` – explainer page that links the three perf demos.
- `/#about` – renders the project README.

## What each demo covers

- **Uncontrolled** – Add fields with `{ uncontrolled: true }` so inputs own their DOM value while the store tracks meta (`dirty`, `touched`, validation).
- **Controlled** – Bind inputs directly to store state when you want validation on each keystroke.
- **Kernel** – Work with row/column data, call `gate.updateField/addRow/removeRow/renameRow`, and read live indexes with `indexStore.getColumn()`.
- **Kernel + worker** – Enable `offloadToWorker: true` to keep the main thread free on large datasets and read indexes via `snapshot()`.
- **Backend sync** – Use `createBackendSync` to debounce pushes, retry failures, and merge server patches without clobbering user edits.
- **Sudoku** – Drive a 9×9 puzzle with `createFormKernel`, field-level cells, row-level selectors, and column watchers via memoised selectors.
- **2048** – Slide tiles with `createFormKernel`, demonstrating row-level summaries and column watchers derived from memoised selectors.
- **Validation** – Provide your own schema resolver; the demo flips between Zod and AJV to show the contract.
- **Perf / Mega variants** – Observe how selectors keep 5k–10k fields responsive and compare against React Hook Form and Formik.
- **Sweet-state mega** – Same 10k stress grid built with react-sweet-state for state management comparison.

## Import paths

- When you consume the library from npm: `import { useForm } from 'rezend-form'`.
- When developing inside this repo, the examples import from `../../src` so you see changes instantly.

## Project layout

- `examples/src/main.tsx` boots the demo shell and handles the hash router.
- `examples/useForm/**/*` contains the basic uncontrolled/controlled examples.
- `examples/kernel/**/*`, `examples/backend-sync`, `examples/validation`, etc. hold the feature-specific demos.
- `examples/vite.config.ts` whitelists the monorepo root so Vite can import from `../../src`.

## Deploying the demo (Vercel)

If you want to host the examples, point Vercel at the repo root. The provided `vercel.json` runs:

- `npm ci`
- `npm run examples:install`
- `npm run examples:build`

and publishes `examples/dist`.

> The examples deliberately stick to Vite defaults—no extra tooling—so feel free to copy/paste snippets into your own setup.
