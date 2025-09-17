import React from 'react';
import hljs from 'highlight.js/lib/core';
import ts from 'highlight.js/lib/languages/typescript';
import js from 'highlight.js/lib/languages/javascript';
import xml from 'highlight.js/lib/languages/xml';
import json from 'highlight.js/lib/languages/json';
import 'highlight.js/styles/github-dark.css';

hljs.registerLanguage('typescript', ts);
hljs.registerLanguage('javascript', js);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('json', json);

export default function CodePanel({ code, filename }: { code: string; filename: string }) {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  // Best-effort language guess based on filename
  const lang = React.useMemo(() => {
    const f = filename.toLowerCase();
    if (f.endsWith('.tsx') || f.endsWith('.ts')) return 'typescript';
    if (f.endsWith('.jsx') || f.endsWith('.js')) return 'javascript';
    if (f.endsWith('.json')) return 'json';
    return 'typescript';
  }, [filename]);

  const html = React.useMemo(() => {
    try {
      return hljs.highlight(code, { language: lang }).value;
    } catch {
      try { return hljs.highlightAuto(code).value; } catch { return code; }
    }
  }, [code, lang]);

  return (
    <div className="panel" style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong>Source:</strong>
        <code>{filename}</code>
        <span style={{ flex: 1 }} />
        <button className="ghost" onClick={() => setOpen((s) => !s)}>{open ? 'Hide code' : 'Show code'}</button>
        <button className="ghost" onClick={onCopy}>{copied ? 'Copied' : 'Copy'}</button>
      </div>
      {open && (
        <div className="scroll" style={{ marginTop: 10 }}>
          <pre className="hljs"><code dangerouslySetInnerHTML={{ __html: html }} /></pre>
        </div>
      )}
    </div>
  );
}
