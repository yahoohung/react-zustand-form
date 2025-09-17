import React from 'react';
// In your app use: import { createFormKernel } from 'react-zustand-form'
import { createFormKernel, makeFieldSelector } from 'react-zustand-form';
import Fps from '../../src/Fps';

// When consuming the built package (as in Vercel builds), the worker URL
// is resolved internally by the library. No override needed here.

export default function KernelWorkerExample() {
  const initialRows = React.useMemo(
    () => ({
      a1: { firstName: 'Alice', lastName: 'A.', email: 'alice@acme.org', score: 10 },
      b2: { firstName: 'Bob', lastName: 'B.', email: 'bob@acme.org', score: 20 },
    }),
    []
  );

  const kernel = React.useMemo(
    () =>
      createFormKernel(initialRows, {
        index: { whitelistColumns: ['firstName', 'lastName', 'email', 'score'] },
        offloadToWorker: true,
        guardInDev: false,
      }),
    [initialRows]
  );

  const rows = kernel.useStore((s) => s.rows);
  const [diffs, setDiffs] = React.useState<any[]>([]);
  const [emailIndex, setEmailIndex] = React.useState<Record<string, unknown>>({});
  const [scoreIndex, setScoreIndex] = React.useState<Record<string, unknown>>({});
  const [totalScore, setTotalScore] = React.useState<number>(0);
  const [updatedKeys, setUpdatedKeys] = React.useState<Set<string>>(() => new Set());
  const timers = React.useRef<Map<string, any>>(new Map());
  const [dirtyKeys, setDirtyKeys] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    const unsub = kernel.diffBus.subscribe((batch) => setDiffs(batch));
    // Kick an initial snapshot read and then poll lightly after updates.
    const readSnap = () => {
      const snap = kernel.indexStore.snapshot();
      const email = (snap?.email?.byRow as any) || {};
      const score = (snap?.score?.byRow as any) || {};
      setEmailIndex(email);
      setScoreIndex(score);
      const sum = Object.values(score).reduce((a: number, v: any) => a + (Number(v) || 0), 0);
      setTotalScore(sum);
    };
    readSnap();
    const id = setInterval(readSnap, 200); // simple demo polling; real apps can schedule smarter
    return () => { clearInterval(id); unsub(); };
  }, [kernel.diffBus, kernel.indexStore]);

  const markUpdated = React.useCallback((k: string) => {
    setUpdatedKeys((s) => { const n = new Set(s); n.add(k); return n; });
    const m = timers.current; if (m.get(k)) clearTimeout(m.get(k));
    m.set(k, setTimeout(() => setUpdatedKeys((s) => { const n = new Set(s); n.delete(k); return n; }), 2000));
  }, []);

  const ScoreCell: React.FC<{ rowKey: string }> = ({ rowKey }) => {
    const value = kernel.useStore(makeFieldSelector(rowKey, 'score')) as number | undefined;
    const [raw, setRaw] = React.useState(String(value ?? 0));
    React.useEffect(() => { setRaw(String(value ?? 0)); }, [value]);
    return (
      <input
        type="text"
        inputMode="numeric"
        value={raw}
        onFocus={() => setDirtyKeys((s) => { const n = new Set(s); n.add(`${rowKey}.score`); return n; })}
        onChange={(e) => { const txt = e.currentTarget.value; setRaw(txt); const n = Number(txt); if (Number.isFinite(n)) { markUpdated(`${rowKey}.score`); kernel.gate.updateField(`rows.${rowKey}.score`, n); }}}
        className={updatedKeys.has(`${rowKey}.score`) ? 'cell-updated' : ''}
      />
    );
  };

  return (
    <div>
      <section style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 6px' }}>Kernel + Worker offload</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li><b>What</b>: Column indexing runs inside a Web Worker; UI stays responsive.</li>
          <li><b>Why</b>: Heavy indexing on big datasets can block the main thread; offload keeps UX smooth.</li>
          <li><b>How</b>: Pass <code>offloadToWorker: true</code> to the kernel; read indexes via <code>snapshot()</code> instead of <code>getColumn()</code>.</li>
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
                        onFocus={() => setDirtyKeys((s) => { const n = new Set(s); n.add(`${rk}.firstName`); return n; })}
                        onChange={(e) => { markUpdated(`${rk}.firstName`); kernel.gate.updateField(`rows.${rk}.firstName`, e.currentTarget.value); }}
                        className={updatedKeys.has(`${rk}.firstName`) ? 'cell-updated' : ''}
                      />
                    </td>
                    <td>
                      <input
                        value={String((r as any).lastName ?? '')}
                        onFocus={() => setDirtyKeys((s) => { const n = new Set(s); n.add(`${rk}.lastName`); return n; })}
                        onChange={(e) => { markUpdated(`${rk}.lastName`); kernel.gate.updateField(`rows.${rk}.lastName`, e.currentTarget.value); }}
                        className={updatedKeys.has(`${rk}.lastName`) ? 'cell-updated' : ''}
                      />
                    </td>
                    <td>
                      <input
                        value={String((r as any).email ?? '')}
                        onFocus={() => setDirtyKeys((s) => { const n = new Set(s); n.add(`${rk}.email`); return n; })}
                        onChange={(e) => { markUpdated(`${rk}.email`); kernel.gate.updateField(`rows.${rk}.email`, e.currentTarget.value); }}
                        className={updatedKeys.has(`${rk}.email`) ? 'cell-updated' : ''}
                      />
                    </td>
                  <td>
                    <ScoreCell rowKey={rk} />
                  </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={() => kernel.gate.addRow('c3', { firstName: 'Carol', lastName: 'C.', email: 'carol@acme.org', score: 30 })}>addRow c3</button>
            <button onClick={() => kernel.gate.removeRow('b2')}>removeRow b2</button>
            <button onClick={() => kernel.gate.renameRow('a1', 'A1')}>renameRow a1→A1</button>
            <button
              onClick={() =>
                kernel.gate.applyPatches({
                  'rows.A1.firstName': 'Alice',
                  'rows.A1.lastName': 'Updated',
                  'rows.c3.email': 'carol@example.org',
                  'rows.c3.score': 31,
                })
              }
            >
              apply server patches
            </button>
            <div style={{ marginLeft: 'auto' }}>FPS: <Fps /></div>
          </div>
        </div>

        <div className="panel">
          <h4>email index (snapshot)</h4>
          <pre style={{ maxWidth: 420, whiteSpace: 'pre-wrap' }}>{JSON.stringify(emailIndex, null, 2)}</pre>

          <h4>score index (snapshot)</h4>
          <pre style={{ maxWidth: 420, whiteSpace: 'pre-wrap' }}>{JSON.stringify(scoreIndex, null, 2)}</pre>

          <h4>last diffs</h4>
          <pre style={{ maxWidth: 420, whiteSpace: 'pre-wrap' }}>{JSON.stringify(diffs, null, 2)}</pre>

          <h4>watchers</h4>
          <div><b>Total score (column sum):</b> <code>{totalScore}</code></div>
          <div><b>watch: a1.email</b>: <code>{String(kernel.useStore(makeFieldSelector('a1','email')) as any)}</code></div>
        </div>
      </section>
    </div>
  );
}
