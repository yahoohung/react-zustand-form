import React from 'react';
import { useFormik } from 'formik';
import Fps from '../src/Fps';
import FpsChart from '../src/FpsChart';
import PerfDescription from '../src/PerfDescription';
import CodePanel from '../src/CodePanel';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - JSON import
import exPkg from '../package.json';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Vite raw import
import source from './App.tsx?raw';

type Grid = Record<string, Record<string, number>>;

function genGrid(r: number, c: number): Grid {
  const out: Grid = {};
  for (let i = 0; i < r; i++) {
    const key = `r${i + 1}`;
    const row: Record<string, number> = {};
    for (let j = 0; j < c; j++) row[`c${j}`] = 0;
    out[key] = row;
  }
  return out;
}

const Cell: React.FC<{
  path: string;
  values: Grid;
  setValue: (path: string, value: number) => void;
  dirtyKeys: Set<string>;
  onDirty: (k: string) => void;
  onBlurSend: (path: string, value: number) => void;
  updatedKeys: Set<string>;
  markUpdated: (k: string) => void;
  validateDelay: number;
  resetNonce: number;
}> = React.memo(({ path, values, setValue, dirtyKeys, onDirty, onBlurSend, updatedKeys, markUpdated, validateDelay, resetNonce }) => {
  const [rowKey, colKey] = path.split('.');
  const value = (values[rowKey] && values[rowKey][colKey]) ?? 0;
  const [raw, setRaw] = React.useState(String(value));
  React.useEffect(() => { setRaw(String(value)); }, [value]);
  React.useEffect(() => { setRaw(String(value)); }, [resetNonce]);

  const [error, setError] = React.useState<string | null>(null);
  const vTimer = React.useRef<any>(null);
  const scheduleValidate = (v: number | null) => {
    if (vTimer.current) clearTimeout(vTimer.current);
    vTimer.current = setTimeout(() => {
      if (v === null || !Number.isFinite(v) || v < 0 || v > 9999) setError('0..9999 required'); else setError(null);
    }, validateDelay);
  };

  const className = [dirtyKeys.has(path) ? 'cell-dirty' : '', updatedKeys.has(path) ? 'cell-changed' : ''].join(' ').trim();

  return (
    <input
      type="text"
      inputMode="numeric"
      value={raw}
      onFocus={() => onDirty(path)}
      onChange={(e) => {
        const txt = e.currentTarget.value; setRaw(txt);
        const n = Number(txt);
        if (Number.isFinite(n)) { setValue(path, n); markUpdated(path); }
        scheduleValidate(Number.isFinite(n) ? n : null);
      }}
      onBlur={() => onBlurSend(path, Number(value ?? 0))}
      className={className}
      title={error ?? ''}
    />
  );
});

export default function FormikMega() {
  const [rowsN, setRowsN] = React.useState(100);
  const [colsN, setColsN] = React.useState(100);
  const [autoCount, setAutoCount] = React.useState(3000);
  const [validateDelay, setValidateDelay] = React.useState(600);

  const initialValues = React.useMemo(() => genGrid(rowsN, colsN), [rowsN, colsN]);
  const formik = useFormik({ initialValues, onSubmit: () => {} });

  const rows = Object.keys(formik.values);
  const cols = Object.keys(formik.values[rows[0]] || {});

  const setValue = React.useCallback((path: string, value: number) => {
    const [rk, ck] = path.split('.');
    formik.setFieldValue(`${rk}.${ck}`, value, false);
  }, [formik]);

  // dirty & updated
  const [dirtyKeys, setDirtyKeys] = React.useState<Set<string>>(() => new Set());
  const dirtyRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => { dirtyRef.current = dirtyKeys; }, [dirtyKeys]);
  const [updatedKeys, setUpdatedKeys] = React.useState<Set<string>>(() => new Set());
  const timers = React.useRef<Map<string, any>>(new Map());
  const markUpdated = React.useCallback((k: string) => {
    setUpdatedKeys((s) => { const n = new Set(s); n.add(k); return n; });
    const m = timers.current; if (m.get(k)) clearTimeout(m.get(k));
    m.set(k, setTimeout(() => setUpdatedKeys((s) => { const n = new Set(s); n.delete(k); return n; }), 2000));
  }, []);
  const onDirty = (k: string) => setDirtyKeys((s) => { const n = new Set(s); n.add(k); return n; });
  const [resetNonce, setResetNonce] = React.useState(0);
  const pendingRef = React.useRef<Record<string, number>>({});
  const resetDirty = React.useCallback(() => {
    setDirtyKeys(new Set());
    setResetNonce((x) => x + 1);
    const pending = pendingRef.current;
    const entries = Object.entries(pending);
    if (entries.length) {
      for (const [p, value] of entries) {
        setValue(p, value);
        markUpdated(p);
      }
      pendingRef.current = {};
    }
  }, [markUpdated, setValue]);

  // auto server updates (skip dirty)
  React.useEffect(() => {
    const id = setInterval(() => {
      if (!rows.length || !cols.length) return;
      let left = Math.min(autoCount, rows.length * cols.length);
      while (left-- > 0) {
        const rk = rows[(Math.random() * rows.length) | 0];
        const ck = cols[(Math.random() * cols.length) | 0];
        const p = `${rk}.${ck}`;
        const next = Math.floor(Math.random() * 1000);
        if (dirtyRef.current.has(p)) {
          pendingRef.current[p] = next;
          continue;
        }
        if (pendingRef.current[p] !== undefined) delete pendingRef.current[p];
        setValue(p, next);
        markUpdated(p);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [rows, cols, autoCount, markUpdated]);

  // simulate backend send on blur
  const [logs, setLogs] = React.useState<string[]>([]);
  const onBlurSend = (path: string, value: number) => setLogs((xs) => [`sent ${path} = ${value}`, ...xs].slice(0, 80));

  const regenerate = () => {
    const next = genGrid(rowsN, colsN);
    formik.resetForm({ values: next });
    setDirtyKeys(new Set()); dirtyRef.current = new Set();
    setUpdatedKeys(new Set()); setResetNonce((x) => x + 1);
    pendingRef.current = {};
  };

  return (
    <div>
      <PerfDescription libLabel={<span><code>Formik</code></span>} />

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
            v: formik {(exPkg as any)?.dependencies?.formik ?? '?'}, react {(exPkg as any)?.dependencies?.react ?? '?'}
          </small>
          <span>FPS: <Fps /></span> <FpsChart seconds={10} />
        </div>
      </div>

      <div className="panel scroll" style={{ marginTop: 12 }}>
        <form>
          <table>
            <thead>
              <tr>
                <th>row</th>
                {cols.map((ck) => (
                  <th key={ck}>{ck}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((rk) => (
                <tr key={rk}>
                  <td>{rk}</td>
                  {cols.map((ck) => (
                    <td key={ck}>
                      <Cell
                        path={`${rk}.${ck}`}
                        values={formik.values}
                        setValue={setValue}
                        dirtyKeys={dirtyKeys}
                        onDirty={onDirty}
                        onBlurSend={(p, v) => onBlurSend(`rows.${p}`, v)}
                        updatedKeys={updatedKeys}
                        markUpdated={markUpdated}
                        validateDelay={validateDelay}
                        resetNonce={resetNonce}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </form>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h4>backend log</h4>
        <ol>
          {logs.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ol>
      </div>

      <CodePanel code={String(source ?? '')} filename={'examples/formik-mega/App.tsx'} />
    </div>
  );
}
