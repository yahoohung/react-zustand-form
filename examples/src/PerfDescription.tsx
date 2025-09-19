import React from 'react';

export default function PerfDescription({ libLabel }: { libLabel: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 12 }}>
      <h3 style={{ margin: '0 0 6px' }}>10k grid — identical rules in every tab</h3>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        <li><b>Library</b>: this tab runs on {libLabel}; the other tabs swap in different libraries but reuse the same behaviour.</li>
        <li><b>Dirty state</b>: red border stays until you hit “Reset dirty”. Server pushes skip any dirty cell.</li>
        <li><b>Change pulse</b>: yellow fade for two seconds whenever a value changes—handy for spotting server updates.</li>
        <li><b>Validation</b>: debounced per cell, accepting integers 0–9999; validation errors show as a tooltip.</li>
        <li><b>Auto server</b>: once per second a configurable number of random cells get new values.</li>
      </ul>
    </section>
  );
}
