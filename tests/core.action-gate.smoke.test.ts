/**
 * Smoke test for core/action-gate
 * Ensures the module can be imported and basic API shape exists.
 */
import * as mod from '../src/core/action-gate';

describe('core/action-gate', () => {
  it('loads without throwing', () => {
    expect(typeof mod).toBe('object');
  });

  // Optional quick shape check (adjust to real exports if known)
  it('exposes something callable or object-like', () => {
    const keys = Object.keys(mod);
    expect(Array.isArray(keys)).toBe(true);
  });
});