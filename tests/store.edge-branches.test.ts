// tests/store.edge-branches.test.ts
import { createBatcher } from '../src/core/store';

test('batcher flush runs inside startTransition when available', async () => {
  const calls: string[] = [];
  (globalThis as any).startTransition = (fn: () => void) => { calls.push('trans'); fn(); };

  const b = createBatcher({ useTransition: true });
  const seen: Array<[string, number]> = [];
  b.push('k', 1 as any, (k, p) => { seen.push([k, p as any]); });

  await Promise.resolve(); // let microtask flush
  expect(calls).toEqual(['trans']);
  expect(seen).toEqual([['k', 1]]);
  delete (globalThis as any).startTransition;
});

test('setState uses 3-arg signature when action is provided', () => {
  const storeImpl = {
    _state: { n: 0 },
    getState() { return this._state; },
    // 3-arity setState like Zustand+devtools
    setState(partial: any, _replace?: boolean, action?: any) {
      if (action) this._state = partial;
    }
  };

  // call our adapter as your code does:
  const adapter = (updater: (s: any) => any, _replace?: boolean, action?: any) => {
    const next = updater(storeImpl.getState());
    const rawSet = (storeImpl as any).setState as Function;
    if (typeof rawSet === 'function' && rawSet.length >= 3 && action !== undefined) {
      rawSet.call(storeImpl, next, true, action);
    } else if (typeof rawSet === 'function') {
      rawSet.call(storeImpl, next, true);
    }
  };

  adapter((s) => ({ n: s.n + 1 }), true, { type: 'inc' });
  expect(storeImpl._state.n).toBe(1);
});