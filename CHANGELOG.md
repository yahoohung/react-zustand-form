## 1.1
- **Hooks subpath export**: Added new `hooks/` folder with `useForm` and `useIndexSnapshot` re‑exports. Consumers can now import either from the root (`import { useForm } from 'react-zustand-form'`) or the subpath (`import { useForm } from 'react-zustand-form/hooks'`).
- **Kernel safety**: 
  - `setStateSafe` now forwards an optional `actionName` to devtools for better traceability.
  - Development‑only guard detects and warns on direct `useStore.setState` calls that bypass the ActionGate.
  - Index guard is automatically skipped in production builds for zero runtime overhead.
- **Types**:
  - Introduced `MaybePromise` and `ResolverResult` utilities for cleaner async resolver typing.
  - `FormStoreApi` now supports partial updates, updater functions, optional `actionName`, and selector‑based subscriptions for improved performance.
  - Resolver signature in `UseFormOptions` updated to use the new utilities.
- **Exports cleanup**: Root `FormState` name clash resolved by aliasing kernel’s `FormState` as `KernelFormState` in the main index.

## 1.0
- Security: Path parser enforces DANGEROUS_KEYS on every segment; numeric-only bracket indices; throws on invalid indices / unclosed bracket.
- Stability: Resolver is fully async-safe with epoch cancellation + try/catch; errors flow into formState.errors.
- Batcher: Merge-by-key with microtask flush; cap by max and drop oldest; optional startTransition wrapping for non-urgent flush.
- Effects: All effects in hooks return cleanup; store subscriptions auto-unsubscribe.
- Devtools: Attached only when NODE_ENV !== 'production' and devtools option true.
- Plugins: Introduced client-only optional `createBackendSync` (coalesce + conditional DOM overwrite for uncontrolled fields).
- Docs: Clarified that quoted keys in paths are not supported in MVP (use dot and numeric brackets only).
*/
