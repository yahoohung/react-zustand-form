import React from 'react';
// In your app use: import { createFormKernel } from 'react-zustand-form'
import { createFormKernel } from '../../src';
import { makeFieldSelector } from '../../src/core/path-selectors';
import { subscribeUiByColumn } from '../../src/core/tiered-subscriptions';
import Fps from '../src/Fps';

export default function KernelExample() {
  const initialRows = React.useMemo(
    () => ({
      u1: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', score: 42 },
      u2: { firstName: 'Linus', lastName: 'Torvalds', email: 'linus@example.net', score: 11 },
    }),
    []
  );

  const kernel = React.useMemo(
    () =>
      createFormKernel(initialRows, {
        index: { whitelistColumns: ['firstName', 'lastName', 'email', 'score'] },
        guardInDev: false, // keep console clean in examples
      }),
    [initialRows]
  );

  const rows = kernel.useStore((s) => s.rows);
  const [diffs, setDiffs] = React.useState<any[]>([]);

  React.useEffect(() => {
    return kernel.diffBus.subscribe((batch) => setDiffs(batch));
  }, [kernel.diffBus]);

  const emailIndex = kernel.indexStore.getColumn('email').byRow;

  // watchers
  const FieldWatch: React.FC<{ row: string; col: string; label?: string }> = ({ row, col, label }) => {
    const val = kernel.useStore(makeFieldSelector(row, col)) as any;
    return (
      <div><b>{label ?? `${row}.${col}`}:</b> <code>{String(val ?? '')}</code></div>
    );
  };
  const RowFullName: React.FC<{ row: string }> = ({ row }) => {
    const full = kernel.useStore((s) => {
      const r = (s.rows as any)[row]; if (!r) return '';
      return `${r.lastName ?? ''} ${r.firstName ?? ''}`.trim();
    });
    return <div><b>{row} full name:</b> <code>{full}</code></div>;
  };
  const [totalScore, setTotalScore] = React.useState<number>(() => {
    const map = kernel.indexStore.getColumn('score').byRow;
    return Object.values(map).reduce((a, v) => a + (Number(v) || 0), 0);
  });
  React.useEffect(() => {
    const watcher = subscribeUiByColumn(kernel.versionMap, 'score', () => {
      const map = kernel.indexStore.getColumn('score').byRow;
      const sum = Object.values(map).reduce((a, v) => a + (Number(v) || 0), 0);
      setTotalScore(sum);
    }, { reuseEnvelope: true });
    const unsub = kernel.useStore.subscribe(() => watcher.check());
    watcher.check();
    return () => { unsub(); };
  }, [kernel.versionMap, kernel.indexStore, kernel.useStore]);

  // UX: highlight inputs when server updates them; and keep-dirty (do not overwrite edited cells)
  const [updatedKeys, setUpdatedKeys] = React.useState<Set<string>>(() => new Set());
  const updatedTimers = React.useRef<Map<string, any>>(new Map());
  const [dirtyKeys, setDirtyKeys] = React.useState<Set<string>>(() => new Set());
  const markUpdated = React.useCallback((k: string) => {
    setUpdatedKeys((prev) => {
      const next = new Set(prev); next.add(k); return next;
    });
    const m = updatedTimers.current;
    if (m.get(k)) clearTimeout(m.get(k));
    m.set(k, setTimeout(() => {
      setUpdatedKeys((prev) => { const next = new Set(prev); next.delete(k); return next; });
      m.delete(k);
    }, 2000));
  }, []);
  React.useEffect(() => {
    return kernel.diffBus.subscribe((batch) => {
      for (const d of batch) {
        // server-origin insert/update only
        if ((d as any).source === 'server' && (d as any).rowKey && (d as any).column && ((d as any).kind === 'insert' || (d as any).kind === 'update')) {
          markUpdated(`${(d as any).rowKey}.${(d as any).column}`);
        }
      }
    });
  }, [kernel.diffBus, markUpdated]);

  // Fake server feed (auto refresh). Skips dirty cells.
  React.useEffect(() => {
    const id = setInterval(() => {
      const rowsNow = kernel.useStore.getState().rows as any;
      const patches: Record<string, unknown> = {};
      const keys = Object.keys(rowsNow);
      if (keys.length === 0) return;
      // update up to 3 random cells per second
      for (let k = 0; k < 3; k++) {
        const rk = keys[Math.floor(Math.random() * keys.length)];
        const cols = ['firstName', 'lastName', 'email', 'score'];
        const col = cols[Math.floor(Math.random() * cols.length)];
        const pathKey = `${rk}.${col}`;
        if (dirtyKeys.has(pathKey)) continue; // keep-dirty policy
        const path = `rows.${rk}.${col}`;
        patches[path] = col === 'score'
          ? Math.floor(Math.random() * 100)
          : (col === 'email' ? `${rk}@example.org` : Math.random().toString(36).slice(2, 7));
      }
      if (Object.keys(patches).length) kernel.gate.applyPatches(patches);
    }, 1000);
    return () => clearInterval(id);
  }, [kernel, dirtyKeys]);

  const onFocus = (rk: string, col: string) => setDirtyKeys((s) => { const n = new Set(s); n.add(`${rk}.${col}`); return n; });
  const onResetDirty = () => setDirtyKeys(new Set());

  const ScoreCell: React.FC<{ rowKey: string }> = ({ rowKey }) => {
    const value = kernel.useStore(makeFieldSelector(rowKey, 'score')) as number | undefined;
    const [raw, setRaw] = React.useState(String(value ?? 0));
    React.useEffect(() => { setRaw(String(value ?? 0)); }, [value]);
    return (
      <input
        type="text"
        inputMode="numeric"
        value={raw}
        onFocus={() => onFocus(rowKey, 'score')}
        onChange={(e) => {
          const txt = e.currentTarget.value; setRaw(txt);
          const n = Number(txt);
          if (Number.isFinite(n)) { markUpdated(`${rowKey}.score`); kernel.gate.updateField(`rows.${rowKey}.score`, n); }
        }}
        className={updatedKeys.has(`${rowKey}.score`) ? 'cell-updated' : ''}
      />
    );
  };

  return (
    <div>
      <section style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 6px' }}>Kernel (rows × columns)</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li><b>What</b>: Table-like state with a small API: update cell, add/remove/rename row, apply patches.</li>
          <li><b>Why</b>: Keep index, versions and diffs in sync for fast lookups and external syncing.</li>
          <li><b>How</b>: Use <code>gate.updateField</code>/<code>addRow</code>/<code>removeRow</code>/<code>renameRow</code>; subscribe to <code>diffBus</code>; read column index via <code>indexStore.getColumn(col)</code>.</li>
        </ul>
      </section>

      <section className="grid">
        <div className="panel">
          <h4>Rows</h4>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>key</th>
                  <th>first</th>
                  <th>last</th>
                  <th>email</th>
                  <th>score</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(rows).map(([rk, r]) => (
                  <tr key={rk}>
                    <td>{rk}</td>
                    <td>
                    <input
                      value={String((r as any).firstName ?? '')}
                      onFocus={() => onFocus(rk, 'firstName')}
                      onChange={(e) => { markUpdated(`${rk}.firstName`); kernel.gate.updateField(`rows.${rk}.firstName`, e.currentTarget.value); }}
                      className={updatedKeys.has(`${rk}.firstName`) ? 'cell-updated' : ''}
                    />
                  </td>
                  <td>
                    <input
                      value={String((r as any).lastName ?? '')}
                      onFocus={() => onFocus(rk, 'lastName')}
                      onChange={(e) => { markUpdated(`${rk}.lastName`); kernel.gate.updateField(`rows.${rk}.lastName`, e.currentTarget.value); }}
                      className={updatedKeys.has(`${rk}.lastName`) ? 'cell-updated' : ''}
                    />
                  </td>
                  <td>
                    <input
                      value={String((r as any).email ?? '')}
                      onFocus={() => onFocus(rk, 'email')}
                      onChange={(e) => { markUpdated(`${rk}.email`); kernel.gate.updateField(`rows.${rk}.email`, e.currentTarget.value); }}
                      className={updatedKeys.has(`${rk}.email`) ? 'cell-updated' : ''}
                    />
                  </td>
                  <td><ScoreCell rowKey={rk} /></td>
                </tr>
              ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => kernel.gate.addRow('u3', { firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.org', score: 77 })}>addRow u3</button>
            <button onClick={() => kernel.gate.removeRow('u2')}>removeRow u2</button>
            <button onClick={() => kernel.gate.renameRow('u1', 'user1')}>renameRow u1→user1</button>
            <button
              onClick={() =>
                kernel.gate.applyPatches({
                  'rows.user1?.firstName': 'Ada',
                  'rows.user1?.lastName': 'Lovelace',
                  'rows.u2.firstName': 'Linus',
                  'rows.u2.lastName': 'Torvalds',
                  'rows.u2.email': 'torvalds@example.org',
                  'rows.u2.score': 33,
                } as any)
              }
            >
              apply server patches
            </button>
            <button className="ghost" onClick={onResetDirty}>reset user edits</button>
            <div style={{ marginLeft: 'auto' }}>FPS: <Fps /></div>
          </div>
        </div>

        <div className="panel">
          <h4>email index</h4>
          <pre style={{ maxWidth: 420, whiteSpace: 'pre-wrap' }}>{JSON.stringify(emailIndex, null, 2)}</pre>

          <h4>last diffs</h4>
          <pre style={{ maxWidth: 420, whiteSpace: 'pre-wrap' }}>{JSON.stringify(diffs, null, 2)}</pre>

          <h4>watchers</h4>
          <FieldWatch row="u1" col="email" label="watch: u1.email" />
          <RowFullName row="u1" />
          <div><b>Total score (column sum):</b> <code>{totalScore}</code></div>
        </div>
      </section>
    </div>
  );
}
