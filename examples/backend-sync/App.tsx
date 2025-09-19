import React from 'react';
// In your app, import from 'react-zustand-form' and 'react-zustand-form/plugins'
import { createFormKernel } from '../../src';
import { createBackendSync } from '../../src/plugins';

type Rows = Record<string, { name?: string; email?: string; score?: number }>;

export default function BackendSyncExample() {
  const initialRows = React.useMemo<Rows>(
    () => ({
      u1: { name: 'Ada', email: 'ada@example.com', score: 42 },
      u2: { name: 'Linus', email: 'linus@example.net', score: 11 },
    }),
    []
  );

  const kernel = React.useMemo(
    () =>
      createFormKernel(initialRows, {
        index: { whitelistColumns: ['name', 'email', 'score'] },
        guardInDev: false,
      }),
    [initialRows]
  );

  const rows = kernel.useStore((s: { rows: any; }) => s.rows);

  // Push logs
  const [logs, setLogs] = React.useState<string[]>([]);
  const addLog = React.useCallback((line: string) => setLogs((xs) => [line, ...xs].slice(0, 50)), []);

  const syncRef = React.useRef<ReturnType<typeof createBackendSync> | null>(null);
  React.useEffect(() => {
    // Simple fake network push: resolves after a short delay; randomly fails once in a while
    let counter = 0;
    const sync = createBackendSync(
      { diffBus: kernel.diffBus, gate: kernel.gate, getState: kernel.useStore.getState },
      {
        debounceMs: 200,
        coalesceSamePath: true,
        retry: { retries: 1, backoffMs: () => 300 },
        keepDirtyValues: true,
        onPushStart: (b) => addLog(`push start: ${b.length} diffs`),
        onPushSuccess: (b) => addLog(`push ok: ${b.length} diffs`),
        onPushError: (_b, e, willRetry) => addLog(`push err: ${String((e as any)?.message || e)}${willRetry ? ' (retrying)' : ''}`),
        push: async (batch) => {
          // emulate network latency
          await new Promise((r) => setTimeout(r, 250));
          counter++;
          // fail every 5th push once to demo retry
          if (counter % 5 === 0) throw new Error('network glitch');
          // pretend server accepted and may respond with canonicalised patch later
        },
      }
    );
    sync.start();
    syncRef.current = sync;
    return () => { sync.stop(); sync.dispose(); syncRef.current = null; };
  }, [addLog, kernel.diffBus, kernel.gate, kernel.useStore.getState]);

  // helper: simulate server patches (e.g., canonicalisation) with dirty-first policy
  const applyServerPatch = React.useCallback(() => {
    const sync = syncRef.current!;
    // Suppose server normalises emails to example.org; u1 local may already be edited
    sync.applyServerPatch({
      patches: {
        'rows.u1.email': 'ada@example.org',
        'rows.u2.name': 'Torvalds',
      },
    });
    addLog('server patches applied');
  }, [addLog]);

  return (
    <div>
      <section style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 6px' }}>Backend sync (diffs in/out)</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li><b>What</b>: Batch local diffs, send them to the server, and replay server patches back into the store.</li>
          <li><b>Why</b>: Keeps chatter off the wire and respects user edits thanks to the keep-dirty policy.</li>
          <li><b>How</b>: Wire up <code>createBackendSync</code> with your push function, then call <code>flush</code>/<code>applyServerPatch</code>/<code>retry</code> hooks when needed.</li>
        </ul>
      </section>

      <section style={{ display: 'flex', gap: 24 }}>
        <div>
          <h4>Rows</h4>
          <table>
            <thead>
              <tr>
                <th>key</th>
                <th>name</th>
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
                      value={String((r as any).name ?? '')}
                      onChange={(e) => kernel.gate.updateField(`rows.${rk}.name`, e.currentTarget.value)}
                    />
                  </td>
                  <td>
                    <input
                      value={String((r as any).email ?? '')}
                      onChange={(e) => kernel.gate.updateField(`rows.${rk}.email`, e.currentTarget.value)}
                    />
                  </td>
                  <td>{String((r as any).score ?? '')}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => syncRef.current?.flush()}>flush now</button>
            <button onClick={applyServerPatch}>simulate server patch</button>
          </div>
        </div>

        <div>
          <h4>push logs</h4>
          <ol>
            {logs.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
