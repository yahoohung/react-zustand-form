import React from 'react';
import { createFormKernel } from '../../src';

type RowIndex = 0 | 1 | 2 | 3;
type ColIndex = 0 | 1 | 2 | 3;

type RowKey = `r${RowIndex}`;
type ColKey = `c${ColIndex}`;

interface Tile {
  id: string;
  value: number;
}

type Cell = Tile | null;

type Board = Record<RowKey, Record<ColKey, Cell>>;

const ROW_KEYS: RowKey[] = ['r0', 'r1', 'r2', 'r3'];
const COL_KEYS: ColKey[] = ['c0', 'c1', 'c2', 'c3'];

const DIRECTIONS = ['left', 'right', 'up', 'down'] as const;
type Direction = (typeof DIRECTIONS)[number];

const randomInt = (max: number) => Math.floor(Math.random() * max);

function createEmptyBoard(): Board {
  return ROW_KEYS.reduce<Board>((acc, rk) => {
    acc[rk] = COL_KEYS.reduce<Record<ColKey, Cell>>((cols, ck) => {
      cols[ck] = null;
      return cols;
    }, {} as Record<ColKey, Cell>);
    return acc;
  }, {} as Board);
}

function boardToPatches(board: Board) {
  const patches: Record<string, Cell> = {};
  ROW_KEYS.forEach((rk) => {
    COL_KEYS.forEach((ck) => {
      patches[`rows.${rk}.${ck}`] = board[rk][ck];
    });
  });
  return patches;
}

function cloneBoard(board: Board): Board {
  return ROW_KEYS.reduce<Board>((acc, rk) => {
    acc[rk] = COL_KEYS.reduce<Record<ColKey, Cell>>((cols, ck) => {
      const tile = board[rk][ck];
      cols[ck] = tile ? { ...tile } : null;
      return cols;
    }, {} as Record<ColKey, Cell>);
    return acc;
  }, {} as Board);
}

function getEmptyCells(board: Board) {
  const cells: Array<[RowKey, ColKey]> = [];
  ROW_KEYS.forEach((rk) => {
    COL_KEYS.forEach((ck) => {
      if (!board[rk][ck]) cells.push([rk, ck]);
    });
  });
  return cells;
}

function spawnRandomTile(board: Board, makeTile: (value: number) => Tile, count = 1): Board {
  const next = cloneBoard(board);
  let remaining = count;
  while (remaining > 0) {
    const empty = getEmptyCells(next);
    if (!empty.length) break;
    const [rk, ck] = empty[randomInt(empty.length)];
    const value = Math.random() < 0.9 ? 2 : 4;
    next[rk][ck] = makeTile(value);
    remaining -= 1;
  }
  return next;
}

function compressRow(row: Cell[], makeTile: (value: number) => Tile) {
  const tiles = row.filter((n): n is Tile => n != null);
  const result: Cell[] = [];
  let scoreGain = 0;
  for (let i = 0; i < tiles.length; i++) {
    const current = tiles[i];
    const next = tiles[i + 1];
    if (next && current.value === next.value) {
      const mergedValue = current.value * 2;
      const mergedTile = makeTile(mergedValue);
      result.push(mergedTile);
      scoreGain += mergedValue;
      i += 1;
    } else {
      result.push(current);
    }
  }
  while (result.length < 4) result.push(null);
  return { row: result, scoreGain };
}

function transpose(board: Board): Board {
  const transposed = createEmptyBoard();
  ROW_KEYS.forEach((rk, rIdx) => {
    COL_KEYS.forEach((ck, cIdx) => {
      const targetRow = `r${cIdx}` as RowKey;
      const targetCol = `c${rIdx}` as ColKey;
      transposed[targetRow][targetCol] = board[rk][ck];
    });
  });
  return transposed;
}

function reverseRows(board: Board): Board {
  const reversed = createEmptyBoard();
  ROW_KEYS.forEach((rk) => {
    COL_KEYS.forEach((ck, idx) => {
      const targetCol = `c${3 - idx}` as ColKey;
      reversed[rk][targetCol] = board[rk][ck];
    });
  });
  return reversed;
}

function moveLeft(board: Board, makeTile: (value: number) => Tile) {
  const result = createEmptyBoard();
  let moved = false;
  let scoreGain = 0;

  ROW_KEYS.forEach((rk) => {
    const rowValues = COL_KEYS.map((ck) => board[rk][ck]);
    const { row, scoreGain: gain } = compressRow(rowValues, makeTile);
    scoreGain += gain;
    row.forEach((value, idx) => {
      const colKey = `c${idx}` as ColKey;
      result[rk][colKey] = value;
      if (value !== board[rk][colKey]) moved = true;
    });
  });

  return { board: result, moved, scoreGain };
}

function move(board: Board, direction: Direction, makeTile: (value: number) => Tile) {
  const current = cloneBoard(board);

  switch (direction) {
    case 'left':
      return moveLeft(current, makeTile);
    case 'right': {
      const reversed = reverseRows(current);
      const moved = moveLeft(reversed, makeTile);
      return { board: reverseRows(moved.board), moved: moved.moved, scoreGain: moved.scoreGain };
    }
    case 'up': {
      const transposed = transpose(current);
      const moved = moveLeft(transposed, makeTile);
      return { board: transpose(moved.board), moved: moved.moved, scoreGain: moved.scoreGain };
    }
    case 'down': {
      const transposed = transpose(current);
      const reversed = reverseRows(transposed);
      const moved = moveLeft(reversed, makeTile);
      return { board: transpose(reverseRows(moved.board)), moved: moved.moved, scoreGain: moved.scoreGain };
    }
    default:
      return { board: current, moved: false, scoreGain: 0 };
  }
}

function boardsEqual(a: Board, b: Board) {
  return ROW_KEYS.every((rk) =>
    COL_KEYS.every((ck) => (a[rk][ck]?.value ?? 0) === (b[rk][ck]?.value ?? 0))
  );
}

function hasMoves(board: Board) {
  const scratch = (value: number): Tile => ({ id: `scratch-${value}`, value });
  if (getEmptyCells(board).length) return true;
  return DIRECTIONS.some((dir) => {
    const { board: next } = move(board, dir as Direction, scratch);
    return !boardsEqual(board, next);
  });
}

function boardFromState(state: { rows: Board }): Board {
  return ROW_KEYS.reduce<Board>((acc, rk) => {
    acc[rk] = COL_KEYS.reduce<Record<ColKey, Cell>>((cols, ck) => {
      cols[ck] = state.rows[rk][ck];
      return cols;
    }, {} as Record<ColKey, Cell>);
    return acc;
  }, {} as Board);
}

const Tile: React.FC<{ value: number; row: number; col: number }> = React.memo(
  ({ value, row, col }) => {
    const display = value === 0 ? '' : value.toString();

    const [animate, setAnimate] = React.useState(false);
    const prevRef = React.useRef<number>(value);

    React.useEffect(() => {
      setAnimate(true);
      const timer = setTimeout(() => setAnimate(false), 180);
      return () => clearTimeout(timer);
    }, []);

    React.useEffect(() => {
      if (value !== prevRef.current) {
        setAnimate(true);
        const timer = setTimeout(() => setAnimate(false), 180);
        prevRef.current = value;
        return () => clearTimeout(timer);
      }
      prevRef.current = value;
    }, [value]);

    const scale = animate && value ? 1.08 : 1;
    const className = `tile tile-${value}`;

    const style: React.CSSProperties = {
      transform: `translate(calc(var(--tile-unit) * ${col}), calc(var(--tile-unit) * ${row})) scale(${scale})`,
    };

    return (
      <div className={className} style={style}>
        {display}
      </div>
    );
  }
);

const RowSummary: React.FC<{ kernel: ReturnType<typeof createFormKernel>; rowKey: RowKey }> = React.memo(
  ({ kernel, rowKey }) => {
    const signature = kernel.useStore(
      React.useCallback(
        (state) => COL_KEYS.map((ck) => state.rows[rowKey][ck]?.value ?? 0).join(','),
        [rowKey]
      )
    );
    const values = React.useMemo(() => signature.split(',').map((x) => Number(x)), [signature]);
    const sum = values.reduce((acc, cur) => acc + cur, 0);
    const max = Math.max(0, ...values);
    return (
      <li>
        <strong>Row {Number(rowKey.slice(1)) + 1}:</strong> sum {sum}, max {max}
      </li>
    );
  }
);

const ColumnSummary: React.FC<{ kernel: ReturnType<typeof createFormKernel>; colKey: ColKey }> = React.memo(
  ({ kernel, colKey }) => {
    const signature = kernel.useStore(
      React.useCallback(
        (state) => ROW_KEYS.map((rk) => state.rows[rk][colKey]?.value ?? 0).join(','),
        [colKey]
      )
    );
    const values = React.useMemo(() => signature.split(',').map((x) => Number(x)), [signature]);
    const sum = values.reduce((acc, cur) => acc + cur, 0);
    const max = Math.max(0, ...values);
    return (
      <li>
        <strong>Col {Number(colKey.slice(1)) + 1}:</strong> sum {sum}, max {max}
      </li>
    );
  }
);

export default function Game2048() {
  const nextIdRef = React.useRef(0);
  const makeTile = React.useCallback((value: number) => ({ id: `tile-${nextIdRef.current++}`, value }), []);

  const [seed, setSeed] = React.useState(() => Math.random());

  const kernel = React.useMemo(() => {
    const base = createEmptyBoard();
    const initial = spawnRandomTile(spawnRandomTile(base, makeTile), makeTile);
    return createFormKernel<Board>(initial, {
      index: { whitelistColumns: [...COL_KEYS] },
      guardInDev: false,
    });
  }, [makeTile, seed]);

  const [score, setScore] = React.useState(0);
  const [best, setBest] = React.useState(0);
  const [status, setStatus] = React.useState<'playing' | 'won' | 'lost'>('playing');

  const applyBoard = React.useCallback(
    (next: Board) => {
      kernel.gate.applyPatches(boardToPatches(next));
    },
    [kernel]
  );

  const handleMove = React.useCallback(
    (direction: Direction) => {
      if (status !== 'playing') return;
      const current = boardFromState(kernel.useStore.getState());
      const { board: movedBoard, moved, scoreGain } = move(current, direction, makeTile);
      if (!moved) return;
      const withSpawn = spawnRandomTile(movedBoard, makeTile);
      applyBoard(withSpawn);

      setScore((s) => {
        const nextScore = s + scoreGain;
        setBest((b) => Math.max(b, nextScore));
        return nextScore;
      });

      const highestTile = ROW_KEYS.reduce(
        (acc, rk) => Math.max(acc, ...COL_KEYS.map((ck) => withSpawn[rk][ck]?.value ?? 0)),
        0
      );
      if (highestTile >= 2048) {
        setStatus('won');
        return;
      }
      if (!hasMoves(withSpawn)) {
        setStatus('lost');
      }
    },
    [applyBoard, kernel, makeTile, status]
  );

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const map: Record<string, Direction> = {
        ArrowLeft: 'left',
        ArrowRight: 'right',
        ArrowUp: 'up',
        ArrowDown: 'down',
      };
      const dir = map[event.key];
      if (!dir) return;
      event.preventDefault();
      handleMove(dir);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleMove]);

  const reset = React.useCallback(() => {
    nextIdRef.current = 0;
    setSeed(Math.random());
    setScore(0);
    setStatus('playing');
  }, []);

  const rowsState = kernel.useStore((state) => state.rows);
  const tiles = React.useMemo(
    () => {
      const list: Array<{ id: string; value: number; row: number; col: number }> = [];
      ROW_KEYS.forEach((rk, rIdx) => {
        COL_KEYS.forEach((ck, cIdx) => {
          const cell = rowsState[rk][ck];
          if (cell) {
            list.push({ id: cell.id, value: cell.value, row: rIdx, col: cIdx });
          }
        });
      });
      return list;
    },
    [rowsState]
  );

  return (
    <div className="game2048">
      <header>
        <div>
          <h3>2048 (row & column watchers)</h3>
          <p className="muted">
            Use the arrow keys or buttons to slide tiles. Row and column summaries subscribe to the
            kernel with memoised selectors.
          </p>
        </div>
        <div className="scoreboard">
          <div className="score">Score: {score}</div>
          <div className="score">Best: {best}</div>
        </div>
      </header>

      <section className="panel">
        <h4>Why react-zustand-form fits 2048</h4>
        <ul className="feature-list">
          <li><strong>Structured grid state.</strong> Every tile lives at `rows.rX.cY`, so move logic just reads the board snapshot and pushes patches back through the kernel.</li>
          <li><strong>Scoped subscriptions.</strong> Tiles subscribe at field level; rows and columns use memoised selectors. Only the cells that change re-render, which keeps the animation smooth.</li>
          <li><strong>Action gate + indices.</strong> All mutations flow through `kernel.gate`, keeping the diff bus and column index in sync—handy for logging moves or bolting on undo/replay later.</li>
          <li><strong>Ready to scale.</strong> The kernel can offload indexing to a worker or expose the diff stream if you want bots, analytics, or multiplayer.</li>
        </ul>
      </section>

      <section className="board-frame">
        <div className="axis-corner" aria-hidden="true" />
        <div className="axis axis-top" aria-hidden="true">
          {COL_KEYS.map((_, idx) => (
            <span key={idx}>{idx + 1}</span>
          ))}
        </div>
        <div className="axis axis-left" aria-hidden="true">
          {ROW_KEYS.map((_, idx) => (
            <span key={idx}>{idx + 1}</span>
          ))}
        </div>
        <div className="board">
          <div className="board-grid">
            {Array.from({ length: 16 }).map((_, idx) => (
              <div key={idx} className="grid-cell" />
            ))}
          </div>
          <div className="tile-layer">
            {tiles.map((tile) => (
              <Tile key={tile.id} value={tile.value} row={tile.row} col={tile.col} />
            ))}
          </div>
        </div>
      </section>

      <div className="controls">
        <button onClick={() => handleMove('up')}>↑</button>
        <div className="controls-row">
          <button onClick={() => handleMove('left')}>←</button>
          <button onClick={() => handleMove('down')}>↓</button>
          <button onClick={() => handleMove('right')}>→</button>
        </div>
        <button className="ghost" onClick={reset}>New game</button>
      </div>

      <div className={`status ${status}`}>
        {status === 'won' && <span>🎉 You made 2048! Continue playing or start a new game.</span>}
        {status === 'lost' && <span>Game over — no moves left.</span>}
      </div>

      <div className="summaries">
        <section>
          <h4>Rows</h4>
          <ul>
            {ROW_KEYS.map((rk) => (
              <RowSummary key={rk} kernel={kernel} rowKey={rk} />
            ))}
          </ul>
        </section>
        <section>
          <h4>Columns</h4>
          <ul>
            {COL_KEYS.map((ck) => (
              <ColumnSummary key={ck} kernel={kernel} colKey={ck} />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
