// ------------------------------------------------------------
// src/index.ts
// ------------------------------------------------------------
export { createFormKernel } from './glue/form-kernel';
export type { KernelOptions } from './glue/form-kernel';
// Avoid name clash with core/types' FormState by aliasing kernel's FormState:
export type { FormState as KernelFormState } from './glue/form-kernel';
export * from './core/action-gate';
export * from './core/diff-bus';
export * from './core/path-selectors';
export * from './core/tiered-subscriptions';
export * from './core/version-map';
export * from './core/types';
export * from './core/path';
export * from './core/store';