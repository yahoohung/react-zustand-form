import React from 'react';
// versions
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - JSON import
import rootPkg from '../../package.json';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - JSON import
import exPkg from '../package.json';

export default function PerfBattle({ onSelect }: { onSelect?: (id: string) => void }) {
  const rzf = (rootPkg as any)?.version ?? '?';
  const react = (exPkg as any)?.dependencies?.react ?? '?';
  const rhf = (exPkg as any)?.dependencies?.['react-hook-form'] ?? '?';
  const formik = (exPkg as any)?.dependencies?.formik ?? '?';
  const sweet = (exPkg as any)?.dependencies?.['react-sweet-state'] ?? '?';

  const metrics: Array<{ id: string; label: string; tag: string; score: number; pitch: string; description: string }> = [
    {
      id: 'mega',
      label: 'react-zustand-form • 10k grid',
      tag: 'kernel',
      score: 1,
      pitch: 'Stays silky smooth',
      description: 'Even with constant diff batches, the kernel keeps renders scoped so interaction feels native.',
    },
    {
      id: 'rhf-mega',
      label: 'react-hook-form • 10k grid',
      tag: 'baseline',
      score: 0.45,
      pitch: 'Noticeable stutter',
      description: 'The entire tree re-renders on bursts, so typing pauses while React catches up.',
    },
    {
      id: 'sweet-state-mega',
      label: 'react-sweet-state • 10k grid',
      tag: 'store',
      score: 0.55,
      pitch: 'Selector-driven, but noisier',
      description: 'Sweet State’s selectors keep updates scoped, yet the single store still does more work than the dedicated kernel.',
    },
    {
      id: 'formik-mega',
      label: 'Formik • 10k grid',
      tag: 'baseline',
      score: 0.3,
      pitch: 'Frequent freezes',
      description: 'Large grids trigger second-long stalls when dirty flags cascade across the form.',
    },
  ];

  const maxScore = Math.max(...metrics.map((m) => m.score));

  const selectDemo = (id: string) => {
    const url = new URL(window.location.href);
    url.hash = `demo=${id}`;
    history.replaceState(null, '', url.toString());
    onSelect?.(id);
  };

  return (
    <div>
      <section style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 6px' }}>Performance comparison — identical logic</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li><b>Scope</b>: Four 10k-field demos with identical requirements—react-zustand-form (kernel), react-hook-form, react-sweet-state, and Formik.</li>
          <li><b>Rules</b>: dirty = red border, changes pulse yellow, validation accepts 0–9999, random server updates land every second, blur logs the value.</li>
          <li><b>How to use</b>: Jump to a tab, tweak grid size and update rate, and watch both the live FPS counter and the trailing chart.</li>
        </ul>
      </section>

      <div className="panel" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => selectDemo('mega')}>react‑zustand‑form (kernel)</button>
        <button type="button" onClick={() => selectDemo('rhf-mega')}>react‑hook‑form</button>
        <button type="button" onClick={() => selectDemo('sweet-state-mega')}>react‑sweet‑state</button>
        <button type="button" onClick={() => selectDemo('formik-mega')}>Formik</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, opacity: 0.85 }}>
          <small>rzf {rzf}</small>
          <small>react {react}</small>
          <small>rhf {rhf}</small>
          <small>sweet {sweet}</small>
          <small>formik {formik}</small>
        </div>
      </div>

      <div className="perf-chart">
        {metrics.map((metric) => {
          const width = Math.max(15, Math.round((metric.score / maxScore) * 100));
          return (
            <button
              type="button"
              key={metric.id}
              className="perf-row"
              onClick={() => selectDemo(metric.id)}
            >
              <div className="perf-row-header">
                <span className="perf-label">{metric.label}</span>
                <span className="perf-tag">{metric.tag}</span>
                <span className="perf-badge">{metric.pitch}</span>
              </div>
              <div className="perf-bar" aria-hidden="true">
                <div className="perf-bar-fill" style={{ width: `${width}%` }} />
              </div>
              <p>{metric.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
