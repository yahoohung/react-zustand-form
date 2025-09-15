/**
 * Smoke test for core/dev-assert
 * Ensures the module can be imported and basic API shape exists.
 */
import * as mod from '../src/core/dev-assert';

describe('core/dev-assert', () => {
  it('loads without throwing', () => {
    expect(typeof mod).toBe('object');
  });

  // Optional: if there is a default export or known function, we can sanity-check.
  it('has at least one export key', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });
});