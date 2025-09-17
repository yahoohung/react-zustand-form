import React from 'react';
import { createFormKernel } from '../../src';
import { makeFieldSelector } from '../../src/core/path-selectors';
import Fps from '../src/Fps';
import FpsChart from '../src/FpsChart';
import PerfDescription from '../src/PerfDescription';
import CodePanel from '../src/CodePanel';
// versions
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - JSON import
import rootPkg from '../../package.json';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - JSON import
import exPkg from '../package.json';
// raw source for copy/view
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Vite raw import
import source from './App.tsx?raw';

type Rows = Record<string, Record<string, number>>;

function genRows(r: number, c: number): Rows {
  const out: Rows = {};
  for (let i = 0; i < r; i++) {
    const key = `r${i + 1}`;
    const row: Record<string, number> = {};
    for (let j = 0; j < c; j++) row[`c${j}`] = 0;
    out[key] = row;
  }
  return out;
}

const Cell: React.FC<{
  kernel: ReturnType<typeof createFormKernel>;
  pathKey: string; // "row.col"
  rowKey: string;
  colKey: string;
  dirtyKeys: Set<string>;
  onDirty: (k: string) => void;
  onBlurSend: (path: string, value: number) => void;
  validateDelay: number;
  resetNonce: number;
}> = React.memo(({ kernel, pathKey, rowKey, colKey, dirtyKeys, onDirty, onBlurSend, validateDelay, resetNonce }) => {
  const value = kernel.useStore(makeFieldSelector(rowKey, colKey)) as number | undefined;
  const [pulse, setPulse] = React.useState(0);
  const prevRef = React.useRef<number | undefined>(value);
  React.useEffect(() => {
    if (prevRef.current !== value) {
      setPulse((x) => x + 1); // trigger highlight
      prevRef.current = value;
      const id = setTimeout(() => setPulse((x) => x + 1), 2000); // end fade
      return () => clearTimeout(id);
    }
  }, [value]);

  const [error, setError] = React.useState<string | null>(null);
  const validateTimer = React.useRef<any>(null);
  const [raw, setRaw] = React.useState<string>(String(value ?? 0));
  // Sync raw to store value when store changes, or when parent reset occurs
  React.useEffect(() => { setRaw(String(value ?? 0)); /* on store change */ }, [value]);
  React.useEffect(() => { setRaw(String(value ?? 0)); setError(null); }, [resetNonce]);

  const scheduleValidate = (v: number | null) => {
    if (validateTimer.current) clearTimeout(validateTimer.current);
    validateTimer.current = setTimeout(() => {
      // very simple rule: must be an integer between 0 and 9999
      if (v === null || !Number.isFinite(v) || v < 0 || v > 9999) setError('0..9999 required'); else setError(null);
    }, validateDelay);
  };

  const isDirty = dirtyKeys.has(pathKey);
  const className = [isDirty ? 'cell-dirty' : '', pulse % 2 === 1 ? 'cell-changed' : ''].join(' ').trim();

  return (
    <input
      type="text"
      inputMode="numeric"
      value={raw}
      onFocus={() => onDirty(pathKey)}
      onChange={(e) => {
        const txt = e.currentTarget.value;
        setRaw(txt);
        const v = Number(txt);
        if (Number.isFinite(v)) kernel.gate.updateField(`rows.${rowKey}.${colKey}`, v);
        scheduleValidate(Number.isFinite(v) ? v : null);
      }}
      onBlur={() => onBlurSend(`rows.${rowKey}.${colKey}`, Number(value ?? 0))}
      className={className}
      title={error ?? ''}
    />
  );
});

export default function MegaGrid() {
  const [rowsN, setRowsN] = React.useState(100);
  const [colsN, setColsN] = React.useState(100); // 100×100 = 10k
  const [autoCount, setAutoCount] = React.useState(3000);
  const [validateDelay, setValidateDelay] = React.useState(600); // ms after typing stops

  const kernelRef = React.useRef<ReturnType<typeof createFormKernel>>();
  if (!kernelRef.current) kernelRef.current = createFormKernel(genRows(rowsN, colsN), { index: { whitelistColumns: Array.from({ length: colsN }, (_, j) => `c${j}`) }, guardInDev: false });
  const kernel = kernelRef.current!;

  const rows = kernel.useStore((s) => s.rows);
  const rowKeys = React.useMemo(() => Object.keys(rows), [rows]);
  const colKeys = React.useMemo(() => (rows[rowKeys[0]] ? Object.keys(rows[rowKeys[0]]) : []), [rows, rowKeys]);

  // dirty & changed tracking
  const [dirtyKeys, setDirtyKeys] = React.useState<Set<string>>(() => new Set());
  const markDirty = React.useCallback((k: string) => setDirtyKeys((s) => { const n = new Set(s); n.add(k); return n; }), []);
  const [resetNonce, setResetNonce] = React.useState(0);
  const resetDirty = () => { setDirtyKeys(new Set()); setResetNonce((x) => x + 1); };

  // auto server updates (skip dirty)
  React.useEffect(() => {
    const id = setInterval(() => {
      const rks = rowKeys; const cks = colKeys;
      if (!rks.length || !cks.length) return;
      const patches: Record<string, number> = {};
      const count = Math.min(autoCount, rks.length * cks.length);
      for (let i = 0; i < count; i++) {
        const rk = rks[(Math.random() * rks.length) | 0];
        const ck = cks[(Math.random() * cks.length) | 0];
        const k = `${rk}.${ck}`;
        if (dirtyKeys.has(k)) continue; // keep-dirty
        patches[`rows.${rk}.${ck}`] = Math.floor(Math.random() * 1000);
      }
      if (Object.keys(patches).length) kernel.gate.applyPatches(patches);
    }, 1000);
    return () => clearInterval(id);
  }, [kernel, rowKeys, colKeys, autoCount, dirtyKeys]);

  // simulate backend send on blur
  const [logs, setLogs] = React.useState<string[]>([]);
  const sendToBackend = React.useCallback((path: string, value: number) => {
    setLogs((xs) => [`sent ${path} = ${value}`, ...xs].slice(0, 80));
  }, []);

  const regenerate = () => {
    const grid = genRows(rowsN, colsN);
    kernel.indexStore.rebuildFromRows(grid);
    const patches: Record<string, number> = {};
    for (const [rk, rv] of Object.entries(grid)) {
      for (const ck of Object.keys(rv)) patches[`rows.${rk}.${ck}`] = (rv as any)[ck];
    }
    kernel.gate.applyPatches(patches);
    setDirtyKeys(new Set());
  };

  return (
    <div>
      <PerfDescription libLabel={<span><code>react-zustand-form</code> (kernel)</span>} />

      <div className="panel" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          Size:
          <input type="number" value={rowsN} onChange={(e) => setRowsN(Number(e.currentTarget.value || 0))} style={{ width: 90, marginLeft: 6 }} /> rows ×
          <input type="number" value={colsN} onChange={(e) => setColsN(Number(e.currentTarget.value || 0))} style={{ width: 90, marginLeft: 6 }} /> cols
          <button style={{ marginLeft: 8 }} onClick={regenerate}>Regenerate</button>
        </div>
        <div>
          Auto update count:
          <input type="number" value={autoCount} onChange={(e) => setAutoCount(Number(e.currentTarget.value || 0))} style={{ width: 120, marginLeft: 6 }} />
        </div>
        <div>
          Validate delay (ms):
          <input type="number" value={validateDelay} onChange={(e) => setValidateDelay(Number(e.currentTarget.value || 0))} style={{ width: 120, marginLeft: 6 }} />
        </div>
        <button className="ghost" onClick={resetDirty}>Reset dirty</button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <small style={{ opacity: 0.8 }}>
            v: rzf {(rootPkg as any)?.version ?? '?'}, react {(exPkg as any)?.dependencies?.react ?? '?'}
          </small>
          <span>FPS: <Fps /></span> <FpsChart seconds={10} />
        </div>
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
                    <Cell
                      kernel={kernel}
                      pathKey={`${rk}.${ck}`}
                      rowKey={rk}
                      colKey={ck}
                      dirtyKeys={dirtyKeys}
                      onDirty={markDirty}
                      onBlurSend={sendToBackend}
                      validateDelay={validateDelay}
                      resetNonce={resetNonce}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h4>backend log</h4>
        <ol>
          {logs.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ol>
      </div>

      <CodePanel code={String(source ?? '')} filename={'examples/mega/App.tsx'} />
    </div>
  );
}
