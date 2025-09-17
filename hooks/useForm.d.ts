import React from 'react';
import { U as UseFormOptions, R as RegisterOptions, F as FormState, a as FormStoreApi } from '../types-BogIX0PI.js';

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

export { useForm, useFormStore };
