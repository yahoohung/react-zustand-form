import React from 'react';
// versions
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - JSON import
import rootPkg from '../../package.json';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - JSON import
import exPkg from '../package.json';

export default function PerfBattle() {
  const rzf = (rootPkg as any)?.version ?? '?';
  const react = (exPkg as any)?.dependencies?.react ?? '?';
  const rhf = (exPkg as any)?.dependencies?.['react-hook-form'] ?? '?';
  const formik = (exPkg as any)?.dependencies?.formik ?? '?';

  return (
    <div>
      <section style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 6px' }}>Performance comparison — identical logic</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li><b>Scope</b>: Three 10k-grid demos with the same behavior implemented using <code>react-zustand-form</code> kernel, <code>react-hook-form</code>, and <code>Formik</code>.</li>
          <li>
            <b>Behavior</b>: dirty/red (keep‑dirty), changed/yellow (2s), debounced validation (0..9999),
            periodic server updates (1s, configurable), blur → backend log, and draft input (no NaN while typing).
          </li>
          <li><b>Usage</b>: Select a demo, adjust grid size and update rate, and compare FPS with the last‑10s chart.</li>
        </ul>
      </section>

      <div className="panel" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => { location.hash = '#mega'; }}>react‑zustand‑form (kernel)</button>
        <button onClick={() => { location.hash = '#rhf-mega'; }}>react‑hook‑form</button>
        <button onClick={() => { location.hash = '#formik-mega'; }}>Formik</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, opacity: 0.85 }}>
          <small>rzf {rzf}</small>
          <small>react {react}</small>
          <small>rhf {rhf}</small>
          <small>formik {formik}</small>
        </div>
      </div>
    </div>
  );
}
