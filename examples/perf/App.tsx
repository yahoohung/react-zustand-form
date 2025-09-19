import React from 'react';
import { createFormKernel } from '../../src';
import { makeFieldSelector } from '../../src/core/path-selectors';

type Rows = Record<string, Record<string, unknown>>;

function genRows(r: number, c: number): Rows {
  const out: Rows = {};
  for (let i = 0; i < r; i++) {
    const key = `r${i + 1}`;
    const row: Record<string, unknown> = {};
    for (let j = 0; j < c; j++) row[`c${j}`] = '';
    out[key] = row;
  }
  return out;
}

const Cell = React.memo(function Cell({ kernel, rowKey, colKey }: { kernel: ReturnType<typeof createFormKernel>; rowKey: string; colKey: string }) {
  const value = kernel.useStore(makeFieldSelector(rowKey, colKey)) as any;
  return (
    <input
      value={String(value ?? '')}
      onChange={(e) => kernel.gate.updateField(`rows.${rowKey}.${colKey}`, e.currentTarget.value)}
    />
  );
});

function FpsMeter() {
  const [fps, setFps] = React.useState(0);
  React.useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const tick = () => {
      frames++;
      const now = performance.now();
      if (now - last >= 1000) {
        setFps(frames);
        frames = 0; last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <span>{fps} fps</span>;
}

export default function PerfDemo() {
  const [rowsN, setRowsN] = React.useState(50);
  const [colsN, setColsN] = React.useState(50);
  const kernelRef = React.useRef<ReturnType<typeof createFormKernel>>();
  if (!kernelRef.current) kernelRef.current = createFormKernel(genRows(rowsN, colsN), { index: { whitelistColumns: Array.from({ length: colsN }, (_, j) => `c${j}`) }, guardInDev: false });
  const kernel = kernelRef.current!;

  const rows = kernel.useStore((s) => s.rows);
  const rowKeys = Object.keys(rows);
  const colKeys = rows[rowKeys[0]] ? Object.keys(rows[rowKeys[0]]) : [];

  const regen = (r: number, c: number) => {
    setRowsN(r); setColsN(c);
    const grid = genRows(r, c);
    kernel.indexStore.rebuildFromRows(grid);
    kernel.gate.applyPatches(Object.fromEntries(Object.entries(grid).flatMap(([rk, rv]) => Object.keys(rv).map((ck) => [`rows.${rk}.${ck}`, (rv as any)[ck]]))));
  };

  const burstRandom = (count: number) => {
    const patches: Record<string, unknown> = {};
    for (let k = 0; k < count; k++) {
      const rk = rowKeys[Math.floor(Math.random() * rowKeys.length)];
      const ck = colKeys[Math.floor(Math.random() * colKeys.length)];
      patches[`rows.${rk}.${ck}`] = Math.random().toString(36).slice(2, 7);
    }
    kernel.gate.applyPatches(patches);
  };

  return (
    <div>
      <section style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 6px' }}>Perf: large grid (fine-grained updates)</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li><b>What</b>: A dense grid where every cell subscribes to its own slice of the store.</li>
          <li><b>Why</b>: Editing one cell should not wake thousands of neighbours—selectors keep the repaint scope tiny.</li>
          <li><b>How</b>: Each cell calls <code>useStore(makeFieldSelector(row,col))</code> and writes through <code>gate.updateField</code> or batched <code>applyPatches</code>.</li>
        </ul>
      </section>

      <div className="panel" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>Size:
          <input type="number" value={rowsN} onChange={(e) => setRowsN(Number(e.currentTarget.value || 0))} style={{ width: 80, marginLeft: 6 }} /> rows ×
          <input type="number" value={colsN} onChange={(e) => setColsN(Number(e.currentTarget.value || 0))} style={{ width: 80, marginLeft: 6 }} /> cols
        </div>
        <button onClick={() => regen(rowsN, colsN)}>Regenerate</button>
        <button onClick={() => regen(100, 50)}>Generate 5k (100×50)</button>
        <button onClick={() => burstRandom(100)}>Random burst ×100</button>
        <div style={{ marginLeft: 'auto' }}>FPS: <FpsMeter /></div>
      </div>

      <div className="panel scroll" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th>row</th>
              {colKeys.map((ck) => (
                <th key={ck}>{ck}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowKeys.map((rk) => (
              <tr key={rk}>
                <td>{rk}</td>
                {colKeys.map((ck) => (
                  <td key={ck}>
                    <Cell kernel={kernel} rowKey={rk} colKey={ck} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <small style={{ display: 'block', marginTop: 8, color: 'var(--muted)' }}>Note: Rendering 5000+ DOM inputs is heavy in any library; the key is that updates remain scoped so typing is smooth.</small>
    </div>
  );
}
