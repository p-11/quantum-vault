export type KeyOfUnion<U> = U extends unknown ? keyof U : never;

export type ValueForKey<U, K extends string | number | symbol> =
  U extends Record<K, infer V> ? V : never;

type UnionKeys<T> = T extends unknown ? keyof T : never;
type UnionValue<U> = U extends Record<string, infer V> ? V : never;

const getRecordUnionKeys = (value: unknown): string[] => {
  if (value === null || typeof value !== 'object') {
    throw new Error('Expected record union to be a non-null object');
  }
  return Object.keys(value);
};

const getSingleRecordUnionKey = (value: unknown): string => {
  const keys = getRecordUnionKeys(value);
  if (keys.length !== 1) {
    throw new Error(`Expected single-key record union, got ${keys.length}`);
  }
  return keys[0];
};

export const match = <T extends string | number | symbol, V>(
  value: T,
  handlers: { [K in T]: () => V }
): V => {
  const handler = handlers[value];
  if (!handler) {
    throw new Error(`Unhandled case "${String(value)}"`);
  }
  return handler();
};

export const matchRecordUnion = <U, R>(
  value: U,
  handlers: { [K in KeyOfUnion<U>]: (val: ValueForKey<U, K>) => R }
): R => {
  const key = getSingleRecordUnionKey(value) as KeyOfUnion<U>;
  const handler = handlers[key];
  if (!handler) {
    throw new Error(`Unhandled case "${String(key)}"`);
  }
  return handler(
    (value as Record<string, unknown>)[key as string] as ValueForKey<
      U,
      typeof key
    >
  );
};

export const matchDiscriminatedUnion = <
  D extends string,
  V extends string,
  U extends Record<D, string> & Record<V, unknown>,
  R
>(
  value: U,
  discriminantKey: D,
  valueKey: V,
  handlers: {
    [K in U[D] & string]: (payload: Extract<U, Record<D, K>>[V]) => R;
  }
): R => {
  const key = value[discriminantKey] as U[D] & string;
  const narrowed = value as Extract<U, Record<D, typeof key>>;
  const handler = handlers[key];
  if (!handler) {
    throw new Error(
      `Unhandled case "${String(key)}" for discriminant "${String(discriminantKey)}"`
    );
  }
  return handler(narrowed[valueKey]);
};

export const getDiscriminatedUnionValue = <
  D extends string,
  V extends string,
  U extends { [P in D]: string } & { [Q in V]: unknown },
  T extends U[D]
>(
  unionValue: U,
  discriminantKey: D,
  valueKey: V,
  expectedCase: T
): Extract<U, { [P in D]: T }>[V] => {
  if (unionValue[discriminantKey] !== expectedCase) {
    throw new Error(
      `Expected case "${String(expectedCase)}", but got "${String(unionValue[discriminantKey])}"`
    );
  }
  return (unionValue as Extract<U, { [P in D]: T }>)[valueKey];
};

export const getRecordUnionKey = <T extends Record<string, unknown>>(
  record: T
): UnionKeys<T> => getSingleRecordUnionKey(record) as UnionKeys<T>;

export function getRecordUnionValue<U>(value: U): UnionValue<U>;
export function getRecordUnionValue<U, K extends string>(
  value: U,
  key: K
): Extract<U, Record<K, unknown>>[K];
export function getRecordUnionValue<U, K extends string>(value: U, key?: K) {
  const keys = getRecordUnionKeys(value);
  const record = value as Record<string, unknown>;

  if (key === undefined) {
    const firstKey = getSingleRecordUnionKey(value);
    return record[firstKey];
  }

  if (!keys.includes(key)) {
    throw new Error(`Key "${key}" not found in record union`);
  }

  return record[key];
}
