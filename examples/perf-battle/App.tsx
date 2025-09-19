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
          <li><b>Scope</b>: Three 10k-field demos with the same requirements, built once with the kernel, once with React Hook Form, and once with Formik.</li>
          <li><b>Rules</b>: dirty = red border, changes pulse yellow, validation accepts 0–9999, random server updates land every second, blur logs the value.</li>
          <li><b>How to use</b>: Jump to a tab, tweak grid size and update rate, and watch both the live FPS counter and the trailing chart.</li>
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
