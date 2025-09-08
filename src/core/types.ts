// ------------------------------------------------------------
// src/core/types.ts
// ------------------------------------------------------------
export type PathSeg = string | number;
export type PathLike = string | ReadonlyArray<PathSeg>;

export type FormErrors = Record<string, string>;
export type DirtyMap = Record<string, boolean>;
export type TouchedMap = Record<string, boolean>;

export interface FormState {
  dirtyFields: DirtyMap;
  touchedFields: TouchedMap;
  errors: FormErrors;
}

export interface UseFormOptions<T> {
  name?: string;
  defaultValues: T;
  devtools?: boolean;
  resolver?: (values: T) => Promise<{ errors?: FormErrors }>|{ errors?: FormErrors };
}

export interface RegisterOptions {
  uncontrolled?: boolean;
}

export interface FormStoreState<T> {
  name: string;
  formState: FormState;
  serverState?: Record<string, unknown>;
  __domRefs?: Record<string, { current: HTMLInputElement|null }>;
  __initial: T;
  resolverEpoch: number;
}

export type FormStoreApi<T> = {
  getState: () => FormStoreState<T>;
  setState: (updater: (s: FormStoreState<T>) => FormStoreState<T>, replace?: boolean, action?: { type: string }) => void;
  subscribe: (fn: (s: FormStoreState<T>) => void) => () => void;
}