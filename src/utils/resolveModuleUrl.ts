// src/utils/resolveModuleUrl.ts
export function resolveModuleUrl(fallbackDirname: string, testBase?: string): string {
    if (testBase) return testBase;
    try {
        // eslint-disable-next-line no-eval
        return (0, eval)('import.meta.url');
    } catch {
        return `file://${fallbackDirname}/`;
    }
}