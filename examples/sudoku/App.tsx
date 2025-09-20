import React from 'react';
import { createFormKernel } from '../../src';
import { makeFieldSelector } from '../../src/core/path-selectors';

type CellValue = '' | string;

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
const ROW_KEYS = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9'] as const;
const COL_KEYS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9'] as const;

type RowKey = (typeof ROW_KEYS)[number];
type ColKey = (typeof COL_KEYS)[number];

type Board = Record<RowKey, Record<ColKey, CellValue>>;

const PUZZLE: Board = {
  r1: { c1: '5', c2: '3', c3: '', c4: '', c5: '7', c6: '', c7: '', c8: '', c9: '' },
  r2: { c1: '6', c2: '', c3: '', c4: '1', c5: '9', c6: '5', c7: '', c8: '', c9: '' },
  r3: { c1: '', c2: '9', c3: '8', c4: '', c5: '', c6: '', c7: '', c8: '6', c9: '' },
  r4: { c1: '8', c2: '', c3: '', c4: '', c5: '6', c6: '', c7: '', c8: '', c9: '3' },
  r5: { c1: '4', c2: '', c3: '', c4: '8', c5: '', c6: '3', c7: '', c8: '', c9: '1' },
  r6: { c1: '7', c2: '', c3: '', c4: '', c5: '2', c6: '', c7: '', c8: '', c9: '6' },
  r7: { c1: '', c2: '6', c3: '', c4: '', c5: '', c6: '', c7: '2', c8: '8', c9: '' },
  r8: { c1: '', c2: '', c3: '', c4: '4', c5: '1', c6: '9', c7: '', c8: '', c9: '5' },
  r9: { c1: '', c2: '', c3: '', c4: '', c5: '8', c6: '', c7: '', c8: '7', c9: '9' },
};

const LOCKED_CELLS = (() => {
  const set = new Set<string>();
  ROW_KEYS.forEach((rk) => {
    COL_KEYS.forEach((ck) => {
      if (PUZZLE[rk][ck]) set.add(`${rk}.${ck}`);
    });
  });
  return set;
})();

function analyse(values: CellValue[]) {
  const counts: Record<string, number> = {};
  values.forEach((v) => {
    if (!v) return;
    counts[v] = (counts[v] ?? 0) + 1;
  });
  const duplicates = Object.keys(counts).filter((k) => counts[k] > 1);
  const missing = DIGITS.filter((d) => !counts[d]);
  return { duplicates, missing };
}

function formatStatus({ duplicates, missing }: { duplicates: string[]; missing: readonly string[] }) {
  if (duplicates.length) return `Conflicts: ${duplicates.join(', ')}`;
  if (missing.length) return `Missing ${missing.length}`;
  return '✓ Complete';
}

const Cell: React.FC<{ rowKey: RowKey; colKey: ColKey; kernel: ReturnType<typeof createFormKernel> }> = React.memo(
  ({ rowKey, colKey, kernel }) => {
    const selector = React.useMemo(() => makeFieldSelector(rowKey, colKey), [rowKey, colKey]);
    const value = kernel.useStore(selector) as CellValue;
    const locked = LOCKED_CELLS.has(`${rowKey}.${colKey}`);

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (locked) return;
      const raw = e.currentTarget.value.replace(/[^1-9]/g, '');
      const next = (raw.length ? raw.slice(-1) : '') as CellValue;
      kernel.gate.updateField(`rows.${rowKey}.${colKey}`, next);
    };

    return (
      <input
        className={`sudoku-cell${locked ? ' locked' : ''}`}
        value={value}
        onChange={onChange}
        disabled={locked}
        inputMode="numeric"
        maxLength={1}
        aria-label={`Row ${rowKey.slice(1)}, column ${colKey.slice(1)}`}
      />
    );
  }
);

const RowStatus: React.FC<{ rowKey: RowKey; kernel: ReturnType<typeof createFormKernel> }> = React.memo(
  ({ rowKey, kernel }) => {
    const row = kernel.useStore(
      React.useCallback((state) => state.rows[rowKey], [rowKey])
    ) as Record<ColKey, CellValue> | undefined;
    const values = React.useMemo(() => COL_KEYS.map((ck) => (row ? row[ck] : '')), [row]);
    const analysis = React.useMemo(() => analyse(values), [values]);
    return (
      <li>
        <strong>Row {rowKey.slice(1)}:</strong> {formatStatus(analysis)}
      </li>
    );
  }
);

const ColumnStatus: React.FC<{ colKey: ColKey; kernel: ReturnType<typeof createFormKernel> }> = React.memo(
  ({ colKey, kernel }) => {
    const columnSignature = kernel.useStore(
      React.useCallback(
        (state) => ROW_KEYS.map((rk) => (state.rows[rk]?.[colKey] as CellValue) ?? '').join('|'),
        [colKey]
      )
    );

    const analysis = React.useMemo(() => {
      const values = columnSignature.split('|').map((v) => (v === '' ? '' : (v as CellValue)));
      return analyse(values as CellValue[]);
    }, [columnSignature]);

    return (
      <li>
        <strong>Col {colKey.slice(1)}:</strong> {formatStatus(analysis)}
      </li>
    );
  }
);

const BOX_GROUPS: Array<{ label: string; rows: RowKey[]; cols: ColKey[] }> = [
  { label: 'Box 1', rows: ['r1', 'r2', 'r3'], cols: ['c1', 'c2', 'c3'] },
  { label: 'Box 2', rows: ['r1', 'r2', 'r3'], cols: ['c4', 'c5', 'c6'] },
  { label: 'Box 3', rows: ['r1', 'r2', 'r3'], cols: ['c7', 'c8', 'c9'] },
  { label: 'Box 4', rows: ['r4', 'r5', 'r6'], cols: ['c1', 'c2', 'c3'] },
  { label: 'Box 5', rows: ['r4', 'r5', 'r6'], cols: ['c4', 'c5', 'c6'] },
  { label: 'Box 6', rows: ['r4', 'r5', 'r6'], cols: ['c7', 'c8', 'c9'] },
  { label: 'Box 7', rows: ['r7', 'r8', 'r9'], cols: ['c1', 'c2', 'c3'] },
  { label: 'Box 8', rows: ['r7', 'r8', 'r9'], cols: ['c4', 'c5', 'c6'] },
  { label: 'Box 9', rows: ['r7', 'r8', 'r9'], cols: ['c7', 'c8', 'c9'] },
];

const BoxStatus: React.FC<{
  label: string;
  rows: RowKey[];
  cols: ColKey[];
  kernel: ReturnType<typeof createFormKernel>;
}> = React.memo(({ label, rows, cols, kernel }) => {
  const signature = kernel.useStore(
    React.useCallback((state) => {
      const bucket: string[] = [];
      rows.forEach((rk) => {
        cols.forEach((ck) => {
          bucket.push(((state.rows[rk]?.[ck] as CellValue) ?? '').toString());
        });
      });
      return bucket.join('|');
    }, [rows, cols])
  );
  const analysis = React.useMemo(() => {
    const values = signature
      .split('|')
      .map((v) => (v === '' ? '' : (v as CellValue))) as CellValue[];
    return analyse(values);
  }, [signature]);
  return (
    <li>
      <strong>{label}:</strong> {formatStatus(analysis)}
    </li>
  );
});

export default function SudokuExample() {
  const kernel = React.useMemo(
    () =>
      createFormKernel<Board>(PUZZLE, {
        index: { whitelistColumns: [...COL_KEYS] },
        guardInDev: false,
      }),
    []
  );

  return (
    <div className="sudoku">
      <header>
        <h3>Sudoku (field / row / column subscriptions)</h3>
        <p style={{ marginBottom: 12 }}>
          Cells subscribe at field level, the row checklist uses row-level selectors, and the column
          checklist uses a memoised column selector.
        </p>
      </header>

      <section className="sudoku-board">
        <table>
          <tbody>
            {ROW_KEYS.map((rk, ri) => (
              <tr key={rk}>
                {COL_KEYS.map((ck, ci) => (
                  <td key={ck} className={`cell-wrapper r${Math.floor(ri / 3)} c${Math.floor(ci / 3)}`}>
                    <Cell rowKey={rk} colKey={ck} kernel={kernel} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="sudoku-panels">
        <section>
          <h4>Row checks</h4>
          <ul>
            {ROW_KEYS.map((rk) => (
              <RowStatus key={rk} rowKey={rk} kernel={kernel} />
            ))}
          </ul>
        </section>
        <section>
          <h4>Column checks</h4>
          <ul>
            {COL_KEYS.map((ck) => (
              <ColumnStatus key={ck} colKey={ck} kernel={kernel} />
            ))}
          </ul>
        </section>
        <section>
          <h4>3×3 boxes</h4>
          <ul>
            {BOX_GROUPS.map((box) => (
              <BoxStatus key={box.label} label={box.label} rows={box.rows} cols={box.cols} kernel={kernel} />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
