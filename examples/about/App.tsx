import React from 'react';
import { marked } from 'marked';
// Import README as raw text so it always mirrors the root file in dev/build
// Vite reloads this when README.md changes.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Vite raw import
import readme from '../../README.md?raw';

export default function About() {
  const [text] = React.useState<string>(() => String(readme ?? ''));
  return (
    <div>
      <section style={{ marginBottom: 12 }}>
        <h3 style={{ margin: '0 0 6px' }}>About this library</h3>
      </section>

      <div className="panel" style={{ marginBottom: 12 }}>
        <h4 style={{ marginTop: 0 }}>Summary</h4>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>Form state tools for React 18/19 with fine‑grained updates.</li>
          <li>Two layers: application hooks (<code>useForm</code>) and a data kernel (<code>createFormKernel</code>).</li>
          <li>Kernel provides atomic field/row operations, column index, diffs and versioning.</li>
          <li>Examples demonstrate uncontrolled/controlled inputs, backend + DOM sync helpers, worker offload, and large grids (including react-hook-form and react-sweet-state baselines).</li>
        </ul>
        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href="#perf-battle">Performance comparison</a>
          <span>·</span>
          <a href="#mega">Kernel 10k grid</a>
          <span>·</span>
          <a href="#rhf-mega">RHF 10k grid</a>
          <span>·</span>
          <a href="#sweet-state-mega">Sweet-state 10k grid</a>
          <span>·</span>
          <a href="#formik-mega">Formik 10k grid</a>
          <span>·</span>
          <a href="#kernel">Kernel basics</a>
          <span>·</span>
          <a href="#kernel-worker">Worker offload</a>
          <span>·</span>
          <a href="#backend-sync">Backend sync</a>
        </div>
      </div>

      <div className="panel scroll">
        <div className="md" dangerouslySetInnerHTML={{ __html: marked.parse(text) as string }} />
      </div>
    </div>
  );
}
