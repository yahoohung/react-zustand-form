import { F as FormStoreApi } from '../types-CiwVpkUD.cjs';

type ResetPolicy = 'keepDirtyValues' | 'serverWins' | 'clientWins' | 'merge';
declare function createBackendSync<T>(store: FormStoreApi<T>, opts?: {
    coalesceMs?: number;
    policy?: ResetPolicy;
}): {
    pushServerPatch(patch: Partial<Record<string, any>>): void;
    dispose(): void;
};

export { type ResetPolicy, createBackendSync };
