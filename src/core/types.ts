/**
 * Core public types used by the form store and hooks.
 *
 */
// ------------------------------------------------------------
// src/core/types.ts
// ------------------------------------------------------------
/** One segment of a path. Can be a key or an index. */
export type PathSeg = string | number;

/** A field path as a dot string or as an array of segments. */
export type PathLike = string | ReadonlyArray<PathSeg>;

/** Error messages keyed by field path. Empty string means no error. */
export type FormErrors = Record<string, string>;
/** Tracks fields that were edited by the user. */
export type DirtyMap = Record<string, boolean>;
/** Tracks fields that were focused/blurred at least once. */
export type TouchedMap = Record<string, boolean>;

/**
 * Lightweight UI state for the form.
 * Does not contain actual field values.
 */
export interface FormState {
  dirtyFields: DirtyMap;
  touchedFields: TouchedMap;
  errors: FormErrors;
}

/**
 * Options for the `useForm` hook.
 * @template T Shape of form values.
 */
export interface UseFormOptions<T> {
  name?: string;
  defaultValues: T;
  devtools?: boolean;
  resolver?: (values: T) => Promise<{ errors?: FormErrors }>|{ errors?: FormErrors };
}

/**
 * Options for field registration.
 * Uncontrolled mode lets the input own its value and events.
 */
export interface RegisterOptions {
  uncontrolled?: boolean;
}

/**
 * Internal store state for one form instance.
 * @template T Shape of form values. Also used to type `defaultValues`.
 */
export interface FormStoreState<T> {
  name: string;
  formState: FormState;
  serverState?: Record<string, unknown>;
  __domRefs?: Record<string, { current: HTMLInputElement|null }>;
  __initial: T;
  resolverEpoch: number;
}

/**
 * Store facade used by hooks and helpers.
 * @template T Shape of form values.
 */
export type FormStoreApi<T> = {
  getState: () => FormStoreState<T>;
  setState: (updater: (s: FormStoreState<T>) => FormStoreState<T>, replace?: boolean, action?: { type: string }) => void;
  subscribe: (fn: (s: FormStoreState<T>) => void) => () => void;
}