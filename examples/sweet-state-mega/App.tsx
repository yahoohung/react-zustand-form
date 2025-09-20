import React from 'react';
import { createStore, createHook } from 'react-sweet-state';
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
type DirtyMap = Record<string, true>;
type DirtyAction = { type: 'mark'; key: string } | { type: 'reset' };

type StoreState = {
  rows: Grid;
};

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

const ROW_HEIGHT = 36;
const OVERSCAN_ROWS = 6;

const GridStore = createStore({
  name: 'sweet-state-mega',
  initialState: {
    rows: genGrid(100, 100),
  } as StoreState,
  actions: {
    setGrid:
      (rows: Grid) =>
      ({ setState }) => {
        setState({ rows });
      },
    setCell:
      (rowKey: string, colKey: string, value: number) =>
      ({ setState, getState }) => {
        const { rows } = getState();
        const prevRow = rows[rowKey] ?? {};
        if (prevRow[colKey] === value) return;
        setState({
          rows: {
            ...rows,
            [rowKey]: { ...prevRow, [colKey]: value },
          },
        });
      },
    applyPatches:
      (patches: Record<string, number>) =>
      ({ setState, getState }) => {
        const entries = Object.entries(patches);
        if (!entries.length) return;
        const { rows } = getState();
        let nextRows: Grid | null = null;
        let changed = false;

        for (let i = 0; i < entries.length; i++) {
          const [path, value] = entries[i];
          const parts = path.split('.');
          if (parts.length !== 3 || parts[0] !== 'rows') continue;
          const rowKey = parts[1];
          const colKey = parts[2];
          const baseRows = nextRows ?? rows;
          const prevRow = baseRows[rowKey] ?? rows[rowKey] ?? {};
          const prevValue = (rows[rowKey] ?? {})[colKey];
          if (prevValue === value) continue;
          const rowUpdated = { ...prevRow, [colKey]: value };
          if (!nextRows) nextRows = { ...rows };
          nextRows[rowKey] = rowUpdated;
          changed = true;
        }

        if (changed && nextRows) setState({ rows: nextRows });
      },
  },
});

const useGridActions = createHook(GridStore, {
  selector: () => null,
  equality: () => true,
});

const useCellValue = createHook(GridStore, {
  selector: (state: StoreState, props: { rowKey: string; colKey: string }) =>
    state.rows[props.rowKey]?.[props.colKey],
  equality: Object.is,
});

const Cell: React.FC<{
  rowKey: string;
  colKey: string;
  pathKey: string;
  isDirty: boolean;
  onDirty: (key: string) => void;
  onBlurSend: (path: string, value: number) => void;
  validateDelay: number;
  resetNonce: number;
  setCell: (rowKey: string, colKey: string, value: number) => void;
}> = React.memo(({ rowKey, colKey, pathKey, isDirty, onDirty, onBlurSend, validateDelay, resetNonce, setCell }) => {
  const [value] = useCellValue({ rowKey, colKey });
  const [pulse, setPulse] = React.useState(0);
  const prevRef = React.useRef<number | undefined>(value);
  React.useEffect(() => {
    if (prevRef.current !== value) {
      setPulse((x) => x + 1);
      prevRef.current = value;
      const id = setTimeout(() => setPulse((x) => x + 1), 2000);
      return () => clearTimeout(id);
    }
  }, [value]);

  const [error, setError] = React.useState<string | null>(null);
  const validateTimer = React.useRef<any>(null);
  const [raw, setRaw] = React.useState<string>(String(value ?? 0));
  React.useEffect(() => { setRaw(String(value ?? 0)); }, [value]);
  React.useEffect(() => { setRaw(String(value ?? 0)); setError(null); }, [resetNonce, value]);

  const scheduleValidate = (v: number | null) => {
    if (validateTimer.current) clearTimeout(validateTimer.current);
    validateTimer.current = setTimeout(() => {
      if (v === null || !Number.isFinite(v) || v < 0 || v > 9999) setError('0..9999 required'); else setError(null);
    }, validateDelay);
  };

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
        const next = Number(txt);
        if (Number.isFinite(next)) setCell(rowKey, colKey, next);
        scheduleValidate(Number.isFinite(next) ? next : null);
      }}
      onBlur={() => onBlurSend(`rows.${rowKey}.${colKey}`, Number(value ?? 0))}
      className={className}
      title={error ?? ''}
    />
  );
});

export default function SweetStateMega() {
  const [rowsN, setRowsN] = React.useState(100);
  const [colsN, setColsN] = React.useState(100);
  const [autoCount, setAutoCount] = React.useState(3000);
  const [validateDelay, setValidateDelay] = React.useState(600);

  const [, actions] = useGridActions();
  const { setGrid, setCell, applyPatches } = actions;

  const [rowKeys, setRowKeys] = React.useState<string[]>(() => Array.from({ length: 100 }, (_, i) => `r${i + 1}`));
  const [colKeys, setColKeys] = React.useState<string[]>(() => Array.from({ length: 100 }, (_, i) => `c${i}`));

  const dirtyRef = React.useRef<DirtyMap>({});
  const [dirtyMap, dispatchDirty] = React.useReducer(
    (state: DirtyMap, action: DirtyAction): DirtyMap => {
      if (action.type === 'mark') {
        if (state[action.key]) return state;
        return { ...state, [action.key]: true };
      }
      if (action.type === 'reset') return {};
      return state;
    },
    {} as DirtyMap
  );
  React.useEffect(() => {
    dirtyRef.current = dirtyMap;
  }, [dirtyMap]);

  const markDirty = React.useCallback((key: string) => dispatchDirty({ type: 'mark', key }), []);

  const [resetNonce, setResetNonce] = React.useState(0);
  const pendingRef = React.useRef<Record<string, number>>({});
  const resetDirty = React.useCallback(() => {
    dispatchDirty({ type: 'reset' });
    setResetNonce((x) => x + 1);
    const pending = pendingRef.current;
    if (Object.keys(pending).length) {
      applyPatches(pending);
      pendingRef.current = {};
    }
  }, [applyPatches]);

  const bodyRef = React.useRef<HTMLDivElement | null>(null);

  const regenerate = React.useCallback(() => {
    const next = genGrid(rowsN, colsN);
    setGrid(next);
    setRowKeys(Array.from({ length: rowsN }, (_, i) => `r${i + 1}`));
    setColKeys(Array.from({ length: colsN }, (_, i) => `c${i}`));
    pendingRef.current = {};
    resetDirty();
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    setScrollTop(0);
  }, [rowsN, colsN, resetDirty, setGrid]);

  React.useEffect(() => {
    regenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const id = setInterval(() => {
      if (!rowKeys.length || !colKeys.length) return;
      const patches: Record<string, number> = {};
      const limit = Math.min(autoCount, rowKeys.length * colKeys.length);
      for (let i = 0; i < limit; i++) {
        const rk = rowKeys[(Math.random() * rowKeys.length) | 0];
        const ck = colKeys[(Math.random() * colKeys.length) | 0];
        const key = `${rk}.${ck}`;
        const path = `rows.${rk}.${ck}`;
        const next = Math.floor(Math.random() * 1000);
        if (dirtyRef.current[key]) {
          pendingRef.current[path] = next;
          continue;
        }
        patches[path] = next;
        if (pendingRef.current[path] !== undefined) delete pendingRef.current[path];
      }
      if (Object.keys(patches).length) applyPatches(patches);
    }, 1000);
    return () => clearInterval(id);
  }, [applyPatches, autoCount, colKeys, rowKeys]);

  const [viewportHeight, setViewportHeight] = React.useState(360);
  const [scrollTop, setScrollTop] = React.useState(0);

  React.useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    const onScroll = () => setScrollTop(el.scrollTop);
    const onResize = () => setViewportHeight(el.clientHeight || 0);

    onScroll();
    onResize();

    el.addEventListener('scroll', onScroll);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(onResize);
      observer.observe(el);
    } else {
      window.addEventListener('resize', onResize);
    }

    return () => {
      el.removeEventListener('scroll', onScroll);
      if (observer) observer.disconnect();
      else window.removeEventListener('resize', onResize);
    };
  }, []);

  const totalHeight = rowKeys.length * ROW_HEIGHT;
  const estimatedVisible = viewportHeight > 0 ? Math.ceil(viewportHeight / ROW_HEIGHT) : rowKeys.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS);
  const endIndex = Math.min(rowKeys.length, startIndex + estimatedVisible + OVERSCAN_ROWS * 2);
  const offsetY = startIndex * ROW_HEIGHT;
  const visibleRows = rowKeys.slice(startIndex, endIndex);

  const gridTemplate = React.useMemo(() => {
    if (!colKeys.length) return '80px';
    return ['80px', ...colKeys.map(() => 'minmax(90px, 1fr)')].join(' ');
  }, [colKeys]);

  const [logs, setLogs] = React.useState<string[]>([]);

  const sendToBackend = React.useCallback((path: string, value: number) => {
    setLogs((xs) => [`sent ${path} = ${value}`, ...xs].slice(0, 80));
  }, []);

  return (
    <div>
      <PerfDescription libLabel={<span><code>react-sweet-state</code></span>} />

      <div className="panel" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          Size:
          <input
            type="number"
            value={rowsN}
            onChange={(e) => setRowsN(Number(e.currentTarget.value || 0))}
            style={{ width: 90, marginLeft: 6 }}
          />{' '}
          rows ×
          <input
            type="number"
            value={colsN}
            onChange={(e) => setColsN(Number(e.currentTarget.value || 0))}
            style={{ width: 90, marginLeft: 6 }}
          />{' '}
          cols
          <button style={{ marginLeft: 8 }} onClick={regenerate}>
            Regenerate
          </button>
        </div>
        <div>
          Auto update count:
          <input
            type="number"
            value={autoCount}
            onChange={(e) => setAutoCount(Number(e.currentTarget.value || 0))}
            style={{ width: 120, marginLeft: 6 }}
          />
        </div>
        <div>
          Validate delay (ms):
          <input
            type="number"
            value={validateDelay}
            onChange={(e) => setValidateDelay(Number(e.currentTarget.value || 0))}
            style={{ width: 120, marginLeft: 6 }}
          />
        </div>
        <button className="ghost" onClick={resetDirty}>Reset dirty</button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <small style={{ opacity: 0.8 }}>
            v: sweet-state {(exPkg as any)?.dependencies?.['react-sweet-state'] ?? '?'}
          </small>
          <span>FPS: <Fps /></span> <FpsChart seconds={10} />
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <div className="perf-grid">
          <div className="perf-grid-header" style={{ gridTemplateColumns: gridTemplate }}>
            <div className="perf-grid-cell perf-row-label">row</div>
            {colKeys.map((ck) => (
              <div key={ck} className="perf-grid-cell">{ck}</div>
            ))}
          </div>
          <div ref={bodyRef} className="perf-grid-body">
            <div style={{ height: totalHeight, position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, transform: `translateY(${offsetY}px)` }}>
                {visibleRows.map((rk) => (
                  <div
                    key={rk}
                    className="perf-grid-row"
                    style={{ gridTemplateColumns: gridTemplate, height: ROW_HEIGHT }}
                  >
                    <div className="perf-grid-cell perf-row-label">{rk}</div>
                    {colKeys.map((ck) => (
                      <div key={ck} className="perf-grid-cell">
                        <Cell
                          rowKey={rk}
                          colKey={ck}
                          pathKey={`${rk}.${ck}`}
                          isDirty={Boolean(dirtyMap[`${rk}.${ck}`])}
                          onDirty={markDirty}
                          onBlurSend={sendToBackend}
                          validateDelay={validateDelay}
                          resetNonce={resetNonce}
                          setCell={setCell}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h4>backend log</h4>
        <ol>
          {logs.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ol>
      </div>

      <CodePanel code={String(source ?? '')} filename={'examples/sweet-state-mega/App.tsx'} />
    </div>
  );
}
