import type { Dispatch, SetStateAction } from 'react';

export type Exact<T, U extends T> = U &
  Record<Exclude<keyof U, keyof T>, never>;

export type RequiredFields<T, K extends keyof T> = Required<Pick<T, K>> &
  Omit<T, K>;

export type WithoutUndefinedFields<T extends Record<string, unknown>> = {
  [K in keyof T]-?: Exclude<T[K], undefined>;
};

export type Resolver<Input, Output> = (input: Input) => Output;

export type Method<Input extends object, Output = void> = {
  input: Input;
  output: Output;
};

export type Brand<T, B extends string> = T & { readonly __brand: B };

export type Stateful<T> = {
  value: T;
  setValue: Dispatch<SetStateAction<T>>;
};

export type ValueTransition<T> = { oldValue: T; newValue: T };

export type Entry<K, V> = { key: K; value: V };

export type Dimensions = { width: number; height: number };
