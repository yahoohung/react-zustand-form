import { P as PathLike, a as PathSeg, F as FormStoreApi, U as UseFormOptions, R as RegisterOptions, b as FormState } from './types-CiwVpkUD.js';
export { D as DirtyMap, c as FormErrors, d as FormStoreState, T as TouchedMap } from './types-CiwVpkUD.js';
import React from 'react';

declare function parsePath(input: PathLike): PathSeg[];
declare function getAtPath<T = any>(obj: any, path: PathLike): T | undefined;
declare function setAtPath<T extends object = any>(obj: any, path: PathLike, value: any): T;

type Batcher = ReturnType<typeof createBatcher>;
declare function createBatcher(cfg?: {
    max?: number;
    useTransition?: boolean;
}): {
    push(key: string, payload: any, flush: (k: string, p: any) => void): void;
};
declare function createFormStore<T>(name: string, initial: T, devtools: boolean): FormStoreApi<T>;

declare function useForm<T>(opts: UseFormOptions<T>): {
    readonly Provider: React.FC<{
        children?: React.ReactNode | undefined;
    }>;
    readonly register: (path: string, ropts?: RegisterOptions) => {
        readonly name: string;
        readonly defaultValue: any;
        readonly ref: (el: HTMLInputElement | null) => void;
        readonly onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
        readonly onBlur: () => void;
        readonly value?: undefined;
    } | {
        readonly name: string;
        readonly value: any;
        readonly onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
        readonly onBlur: () => void;
        readonly defaultValue?: undefined;
        readonly ref?: undefined;
    };
    readonly handleSubmit: (fn: (values: T) => void) => (e?: React.FormEvent) => void;
    readonly formState: FormState;
    readonly store: FormStoreApi<T>;
};
declare function useFormStore<T>(): FormStoreApi<T>;

export { type Batcher, FormState, FormStoreApi, PathLike, PathSeg, RegisterOptions, UseFormOptions, createBatcher, createFormStore, getAtPath, parsePath, setAtPath, useForm, useFormStore };
