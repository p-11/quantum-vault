import type { Entry, WithoutUndefinedFields } from './types';

export const getRecordKeys = <K extends string | number | symbol>(
  record: Partial<Record<K, unknown>>
): K[] => Object.keys(record) as K[];

export const recordMap = <K extends string | number | symbol, T, V>(
  record: Record<K, T>,
  fn: (value: T, key: K) => V
): Record<K, V> => {
  const result = {} as Record<K, V>;
  for (const key of getRecordKeys(record)) {
    result[key] = fn(record[key], key);
  }
  return result;
};

export const pick = <T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: readonly K[]
): Pick<T, K> => {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) result[key] = obj[key];
  }
  return result;
};

export const omit = <T extends Record<string, unknown>, K extends keyof T>(
  record: T,
  keys: readonly K[]
): Omit<T, K> => {
  const result = { ...record };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, K>;
};

export const mergeRecords = <K extends string | number | symbol, T>(
  ...records: readonly Record<K, T>[]
): Record<K, T> => Object.assign({} as Record<K, T>, ...records);

export const recordFromKeys = <K extends string | number | symbol, V>(
  keys: readonly K[],
  getValue: (key: K, index: number) => V
): Record<K, V> => {
  const result = {} as Record<K, V>;
  keys.forEach((key, index) => {
    result[key] = getValue(key, index);
  });
  return result;
};

export const recordFromItems = <T, K extends string | number | symbol>(
  items: readonly T[],
  getKey: (item: T) => K
): Record<K, T> => {
  const result = {} as Record<K, T>;
  for (const item of items) {
    result[getKey(item)] = item;
  }
  return result;
};

export const mirrorRecord = <
  K extends string | number | symbol,
  V extends string | number | symbol
>(
  record: Record<K, V>
): Record<V, K> => {
  const result = {} as Record<V, K>;
  for (const key of getRecordKeys(record)) {
    result[record[key]] = key;
  }
  return result;
};

export const areEqualRecords = <T extends Record<string, unknown>>(
  a: T,
  b: T
): boolean => {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  return keysA.length === keysB.length && keysA.every(key => a[key] === b[key]);
};

export const haveEqualFields = <T extends Record<string, unknown>>(
  fields: readonly (keyof T)[],
  a: T,
  b: T
): boolean => fields.every(field => a[field] === b[field]);

export const withoutUndefinedFields = <T extends Record<string, unknown>>(
  record: T
): WithoutUndefinedFields<T> => {
  const result = {} as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined) result[key] = value;
  }
  return result as WithoutUndefinedFields<T>;
};

export const toEntries = <K extends string | number | symbol, V>(
  record: Record<K, V>
): Entry<K, V>[] =>
  getRecordKeys(record).map(key => ({ key, value: record[key] }));
