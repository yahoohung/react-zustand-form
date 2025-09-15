/**
 * Development-only exports.
 *
 * Provides helpers that are useful during development or debugging:
 * - dev-assert: validate index consistency.
 * - with-index-guard: wrap an ActionGate to detect index mismatches.
 *
 * These are not needed in production and can be tree-shaken out.
 */
 
// src/dev.ts
export * from './core/dev-assert';
export * from './core/with-index-guard';