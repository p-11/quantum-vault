export type Defined<T> = T extends undefined ? never : T;

export const ensurePresent = <T>(
  value: T,
  valueName: string
): NonNullable<T> => {
  if (value === null || value === undefined) {
    throw new Error(
      `Expected ${valueName} to be present, got ${String(value)}`
    );
  }
  // TS cannot narrow generic T after null/undefined check
  return value as NonNullable<T>;
};

export const ensureDefined = <T>(value: T, valueName: string): Defined<T> => {
  if (value === undefined) {
    throw new Error(`Expected ${valueName} to be defined, got undefined`);
  }
  // TS cannot narrow generic T after undefined check
  return value as Defined<T>;
};

export const isOneOf = <T>(item: unknown, items: readonly T[]): item is T =>
  (items as readonly unknown[]).includes(item);
