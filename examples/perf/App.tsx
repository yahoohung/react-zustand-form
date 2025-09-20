import React from 'react';
import { createFormKernel } from '../../src';
import { makeFieldSelector } from '../../src/core/path-selectors';

type Rows = Record<string, Record<string, unknown>>;

const INITIAL_ROWS = 50;
const INITIAL_COLS = 50;

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

function makeRowKeys(count: number) {
  return Array.from({ length: count }, (_, i) => `r${i + 1}`);
}

function makeColKeys(count: number) {
  return Array.from({ length: count }, (_, j) => `c${j}`);
}

function createKernel(rows: number, cols: number): ReturnType<typeof createFormKernel> {
  const whitelist = makeColKeys(cols);
  return createFormKernel(genRows(rows, cols), {
    index: { whitelistColumns: whitelist },
    guardInDev: false,
  });
}

const ROW_HEIGHT = 36;
const OVERSCAN_ROWS = 6;

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
  const [rowsN, setRowsN] = React.useState(INITIAL_ROWS);
  const [colsN, setColsN] = React.useState(INITIAL_COLS);
  const [kernel, setKernel] = React.useState(() => createKernel(INITIAL_ROWS, INITIAL_COLS));
  const [rowKeys, setRowKeys] = React.useState<string[]>(() => makeRowKeys(INITIAL_ROWS));
  const [colKeys, setColKeys] = React.useState<string[]>(() => makeColKeys(INITIAL_COLS));
  const [viewportHeight, setViewportHeight] = React.useState(360);
  const [scrollTop, setScrollTop] = React.useState(0);
  const bodyRef = React.useRef<HTMLDivElement | null>(null);

  const regen = React.useCallback((r: number, c: number) => {
    const nextRows = Number.isFinite(r) ? Math.max(0, Math.floor(r)) : 0;
    const nextCols = Number.isFinite(c) ? Math.max(0, Math.floor(c)) : 0;
    setRowsN(nextRows);
    setColsN(nextCols);
    setRowKeys(makeRowKeys(nextRows));
    setColKeys(makeColKeys(nextCols));
    setKernel(() => createKernel(nextRows, nextCols));
    if (bodyRef.current) {
      bodyRef.current.scrollTop = 0;
    }
    setScrollTop(0);
  }, []);

  React.useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    const handleScroll = () => {
      setScrollTop(el.scrollTop);
    };
    handleScroll();

    el.addEventListener('scroll', handleScroll);

    const updateHeight = () => {
      setViewportHeight(el.clientHeight || 0);
    };
    updateHeight();

    let resizeObs: ResizeObserver | null = null;
    if (typeof ResizeObserver === 'function') {
      resizeObs = new ResizeObserver(updateHeight);
      resizeObs.observe(el);
    } else {
      window.addEventListener('resize', updateHeight);
    }

    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (resizeObs) {
        resizeObs.disconnect();
      } else {
        window.removeEventListener('resize', updateHeight);
      }
    };
  }, [rowKeys.length]);

  const burstRandom = (count: number) => {
    if (!rowKeys.length || !colKeys.length) return;
    const patches: Record<string, unknown> = {};
    for (let k = 0; k < count; k++) {
      const rk = rowKeys[Math.floor(Math.random() * rowKeys.length)];
      const ck = colKeys[Math.floor(Math.random() * colKeys.length)];
      patches[`rows.${rk}.${ck}`] = Math.random().toString(36).slice(2, 7);
    }
    kernel.gate.applyPatches(patches);
  };

  const totalHeight = rowKeys.length * ROW_HEIGHT;
  const estimatedVisible = viewportHeight > 0 ? Math.ceil(viewportHeight / ROW_HEIGHT) : rowKeys.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS);
  const endIndex = Math.min(rowKeys.length, startIndex + estimatedVisible + OVERSCAN_ROWS * 2);
  const offsetY = startIndex * ROW_HEIGHT;
  const visibleRows = rowKeys.slice(startIndex, endIndex);

  const gridTemplate = React.useMemo(() => {
    if (!colKeys.length) return '80px';
    const cols = ['80px', ...colKeys.map(() => 'minmax(90px, 1fr)')];
    return cols.join(' ');
  }, [colKeys]);

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
          <input
            type="number"
            value={rowsN}
            onChange={(e) => {
              const next = Number.parseInt(e.currentTarget.value, 10);
              setRowsN(Number.isFinite(next) ? next : 0);
            }}
            style={{ width: 80, marginLeft: 6 }}
          />{' '}
          rows ×
          <input
            type="number"
            value={colsN}
            onChange={(e) => {
              const next = Number.parseInt(e.currentTarget.value, 10);
              setColsN(Number.isFinite(next) ? next : 0);
            }}
            style={{ width: 80, marginLeft: 6 }}
          />{' '}
          cols
        </div>
        <button onClick={() => regen(rowsN, colsN)}>Regenerate</button>
        <button onClick={() => regen(100, 50)}>Generate 5k (100×50)</button>
        <button onClick={() => burstRandom(100)}>Random burst ×100</button>
        <div style={{ marginLeft: 'auto' }}>FPS: <FpsMeter /></div>
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
                        <Cell kernel={kernel} rowKey={rk} colKey={ck} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <small style={{ display: 'block', marginTop: 8, color: 'var(--muted)' }}>Note: Rendering 5000+ DOM inputs is heavy in any library; the key is that updates remain scoped so typing is smooth.</small>
    </div>
  );
}
