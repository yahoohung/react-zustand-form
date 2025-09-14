// Cached path selectors for field-level O(1) subscriptions.

export type FieldSelector<S = any> = (s: S) => unknown;

const selectorCache = new Map<string, Function>();

export function makeFieldSelector<S = any>(rowKey: string, column: string): FieldSelector<S> {
  const key = `${rowKey}.${column}`;
  const hit = selectorCache.get(key) as FieldSelector<S> | undefined;
  if (hit) return hit;
  const sel: FieldSelector<S> = (s: any) => s?.rows?.[rowKey]?.[column];
  selectorCache.set(key, sel as any);
  return sel;
}

export function dropRowFromSelectorCache(rowKey: string) {
  const prefix = `${rowKey}.`;
  for (const k of selectorCache.keys()) {
    if (k.startsWith(prefix)) selectorCache.delete(k);
  }
}

export function renameRowInSelectorCache(oldKey: string, newKey: string) {
  const oldPrefix = `${oldKey}.`;
  const toAdd: Array<[string, Function]> = [];
  for (const k of Array.from(selectorCache.keys())) {
    if (k.startsWith(oldPrefix)) {
      const val = selectorCache.get(k)!;
      selectorCache.delete(k);
      const suffix = k.slice(oldPrefix.length);
      toAdd.push([`${newKey}.${suffix}`, val]);
    }
  }
  for (const [k, v] of toAdd) selectorCache.set(k, v);
}

export function clearSelectorCache() {
  selectorCache.clear();
}