import React from 'react';

export default function PerfDescription({ libLabel }: { libLabel: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 12 }}>
      <h3 style={{ margin: '0 0 6px' }}>10k grid — same logic across demos</h3>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        <li><b>Library</b>: this tab uses {libLabel}. The other tabs use different libraries but keep the exact same behavior.</li>
        <li><b>Dirty</b>: red border (kept until reset). Focus/typing marks dirty; server updates skip dirty cells.</li>
        <li><b>Changed</b>: yellow fade for 2s on any change (local or server).</li>
        <li><b>Validation</b>: debounced per cell (no validation while typing); rule 0..9999; tooltip shows error.</li>
        <li><b>Auto server</b>: every 1s update N random cells (configurable).</li>
      </ul>
    </section>
  );
}
