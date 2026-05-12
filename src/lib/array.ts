export const isEmpty = <T>(items: readonly T[]): boolean => items.length === 0;

export const range = (length: number): number[] =>
  Array.from({ length }, (_, i) => i);

export const sum = (numbers: readonly number[]): number =>
  numbers.reduce((acc, value) => acc + value, 0);

export const without = <T>(items: readonly T[], exclude: readonly T[]): T[] =>
  items.filter(item => !exclude.includes(item));

export const withoutDuplicates = <T>(
  items: readonly T[],
  getKey?: (item: T) => string | number
): T[] => {
  if (!getKey) return [...new Set(items)];

  const seen = new Set<string | number>();
  return items.filter(item => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const toggleInclusion = <T>(array: readonly T[], item: T): T[] =>
  array.includes(item) ? array.filter(i => i !== item) : [...array, item];

export const splitBy = <T>(
  items: readonly T[],
  predicate: (item: T, index: number) => boolean
): [T[], T[]] => {
  const pass: T[] = [];
  const fail: T[] = [];
  items.forEach((item, index) => {
    (predicate(item, index) ? pass : fail).push(item);
  });
  return [pass, fail];
};

export const toBatches = <T>(array: readonly T[], batchSize: number): T[][] => {
  if (batchSize <= 0) {
    throw new Error(`Expected batchSize > 0, got ${batchSize}`);
  }

  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
};

export const groupItems = <T, K extends string | number | symbol>(
  items: readonly T[],
  getKey: (item: T) => K
): Record<K, T[]> => {
  const result = {} as Record<K, T[]>;
  for (const item of items) {
    const key = getKey(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
};

export const order = <T>(
  array: readonly T[],
  getValue: (item: T) => number,
  direction: 'asc' | 'desc' = 'asc'
): T[] => {
  const multiplier = direction === 'asc' ? 1 : -1;
  return [...array].sort((a, b) => multiplier * (getValue(a) - getValue(b)));
};

export const getLastItem = <T>(array: readonly T[]): T | undefined =>
  array[array.length - 1];

export const haveSameContent = <T>(
  one: readonly T[],
  another: readonly T[]
): boolean => {
  if (one.length !== another.length) return false;
  return one.every((item, index) => item === another[index]);
};

export const getPairComplement = <T>(pair: readonly [T, T], item: T): T =>
  pair[0] === item ? pair[1] : pair[0];

export const updateAtIndex = <T>(
  items: readonly T[],
  index: number,
  update: (item: T) => T
): T[] => items.map((item, i) => (i === index ? update(item) : item));
