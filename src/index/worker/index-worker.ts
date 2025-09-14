// Web Worker script for index store. Communicate via postMessage.
type Msg =
  | { kind: 'init'; opts: any }
  | { kind: 'setCell'; col: string; rowKey: string; value: unknown }
  | { kind: 'removeRow'; rowKey: string }
  | { kind: 'renameRow'; oldKey: string; newKey: string }
  | { kind: 'rebuildFromRows'; rows: Record<string, any> }
  | { kind: 'snapshot'; id: number }
  | { kind: 'reset' };

type Reply =
  | { kind: 'snapshot'; id: number; data: any };

// @ts-expect-error: for bundlers which require importScripts presence
importScripts();

let store: any;

self.onmessage = (ev: MessageEvent<Msg>) => {
  const m = ev.data;
  if (m.kind === 'init') {
    // The host must inject impl on worker global: (__indexStoreImpl)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    store = (self as any).__indexStoreImpl(m.opts);
    return;
  }
  if (!store) return;

  switch (m.kind) {
    case 'setCell': store.setCell(m.col, m.rowKey, m.value); break;
    case 'removeRow': store.removeRow(m.rowKey); break;
    case 'renameRow': store.renameRow(m.oldKey, m.newKey); break;
    case 'rebuildFromRows': store.rebuildFromRows(m.rows); break;
    case 'reset': store.reset(); break;
    case 'snapshot': {
      const data = store.snapshot();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (self as any).postMessage({ kind: 'snapshot', id: m.id, data } as Reply);
      break;
    }
  }
};