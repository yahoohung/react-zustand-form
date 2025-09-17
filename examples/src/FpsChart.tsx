import React from 'react';

export default function FpsChart({ seconds = 10, target = 60 }: { seconds?: number; target?: number }) {
  const [samples, setSamples] = React.useState<number[]>([]);
  const framesRef = React.useRef(0);
  const lastRef = React.useRef<number>(performance.now());
  const rafRef = React.useRef(0);

  React.useEffect(() => {
    const tick = () => {
      framesRef.current++;
      const now = performance.now();
      if (now - lastRef.current >= 1000) {
        const fps = framesRef.current;
        framesRef.current = 0;
        lastRef.current = now;
        setSamples((arr) => {
          const next = [...arr, fps];
          if (next.length > seconds) next.shift();
          return next;
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [seconds]);

  const max = Math.max(target, ...samples, 1);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div title={`last ${seconds}s`} style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 24 }}>
        {Array.from({ length: seconds }).map((_, i) => {
          const v = samples[samples.length - seconds + i] ?? 0;
          const h = Math.max(2, Math.round((v / max) * 24));
          const o = 0.35 + Math.min(0.65, v / target);
          return (
            <div key={i} style={{ width: 6, height: h, background: 'var(--primary)', opacity: o, borderRadius: 2 }} />
          );
        })}
      </div>
    </div>
  );
}

