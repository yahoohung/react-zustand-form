## 1.0
- Security: Path parser enforces DANGEROUS_KEYS on every segment; numeric-only bracket indices; throws on invalid indices / unclosed bracket.
- Stability: Resolver is fully async-safe with epoch cancellation + try/catch; errors flow into formState.errors.
- Batcher: Merge-by-key with microtask flush; cap by max and drop oldest; optional startTransition wrapping for non-urgent flush.
- Effects: All effects in hooks return cleanup; store subscriptions auto-unsubscribe.
- Devtools: Attached only when NODE_ENV !== 'production' and devtools option true.
- Plugins: Introduced client-only optional `createBackendSync` (coalesce + conditional DOM overwrite for uncontrolled fields).
- Docs: Clarified that quoted keys in paths are not supported in MVP (use dot and numeric brackets only).
*/
