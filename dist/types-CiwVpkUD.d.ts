type PathSeg = string | number;
type PathLike = string | ReadonlyArray<PathSeg>;
type FormErrors = Record<string, string>;
type DirtyMap = Record<string, boolean>;
type TouchedMap = Record<string, boolean>;
interface FormState {
    dirtyFields: DirtyMap;
    touchedFields: TouchedMap;
    errors: FormErrors;
}
interface UseFormOptions<T> {
    name?: string;
    defaultValues: T;
    devtools?: boolean;
    resolver?: (values: T) => Promise<{
        errors?: FormErrors;
    }> | {
        errors?: FormErrors;
    };
}
interface RegisterOptions {
    uncontrolled?: boolean;
}
interface FormStoreState<T> {
    name: string;
    formState: FormState;
    serverState?: Record<string, unknown>;
    __domRefs?: Record<string, {
        current: HTMLInputElement | null;
    }>;
    __initial: T;
    resolverEpoch: number;
}
type FormStoreApi<T> = {
    getState: () => FormStoreState<T>;
    setState: (updater: (s: FormStoreState<T>) => FormStoreState<T>, replace?: boolean, action?: {
        type: string;
    }) => void;
    subscribe: (fn: (s: FormStoreState<T>) => void) => () => void;
};

export type { DirtyMap as D, FormStoreApi as F, PathLike as P, RegisterOptions as R, TouchedMap as T, UseFormOptions as U, PathSeg as a, FormState as b, FormErrors as c, FormStoreState as d };
