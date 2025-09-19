// src/utils/resolveModuleUrl.ts
export function resolveModuleUrl(fallbackDirname: string, testBase?: string): string {
  if (testBase) return testBase;

  try {
    // eslint-disable-next-line no-eval
    return (0, eval)('import.meta.url');
  } catch {
    // fall through to the fallback strategy
  }

  let dir = fallbackDirname;
  if (!dir && typeof process !== 'undefined' && typeof process.cwd === 'function') {
    dir = process.cwd();
  }

  if (!dir) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      dir = new Function('try { return typeof __dirname === "string" ? __dirname : ""; } catch { return ""; }')();
    } catch {
      dir = '';
    }
  }

  if (!dir) {
    if (typeof globalThis !== 'undefined') {
      const loc = (globalThis as { location?: { href?: string } })?.location?.href;
      if (loc) return loc;
    }
    return 'file:///';
  }

  const normalized = dir.replace(/\\/g, '/').replace(/\/+$/, '');
  const needsLeadingSlash = normalized.startsWith('/') ? '' : '/';
  return `file://${needsLeadingSlash}${normalized}/`;
}
