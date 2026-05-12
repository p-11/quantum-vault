const defaultMaxCacheSize = 1000;

export const memoize = <T extends (...args: never[]) => unknown>(
  func: T,
  getKey?: (...args: Parameters<T>) => string
): T => {
  const cache = new Map<string, ReturnType<T>>();
  const keyFn = getKey ?? ((...args: unknown[]) => JSON.stringify(args));

  const memoized = (...args: Parameters<T>): ReturnType<T> => {
    const key = keyFn(...args);
    if (cache.has(key)) return cache.get(key)!;

    if (cache.size >= defaultMaxCacheSize) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) cache.delete(firstKey);
    }

    const result = func(...args) as ReturnType<T>;
    cache.set(key, result);
    return result;
  };

  return memoized as unknown as T;
};

type MemoizeAsyncOptions<Args extends unknown[]> = {
  cacheTimeMs?: number;
  getKey?: (...args: Args) => string;
  maxCacheSize?: number;
};

export const memoizeAsync = <T extends (...args: never[]) => Promise<unknown>>(
  func: T,
  options?: MemoizeAsyncOptions<Parameters<T>>
): T => {
  const cache = new Map<string, { data: ReturnType<T>; updatedAt: number }>();
  const keyFn =
    options?.getKey ?? ((...args: unknown[]) => JSON.stringify(args));
  const maxCacheSize = options?.maxCacheSize ?? defaultMaxCacheSize;

  if (maxCacheSize < 1) {
    throw new Error(`Expected maxCacheSize >= 1, got ${maxCacheSize}`);
  }

  const memoized = (...args: Parameters<T>): ReturnType<T> => {
    const key = keyFn(...args);
    const cached = cache.get(key);

    if (cached) {
      if (
        !options?.cacheTimeMs ||
        Date.now() - cached.updatedAt < options.cacheTimeMs
      ) {
        return cached.data;
      }
      cache.delete(key);
    }

    const promise = func(...args) as ReturnType<T>;

    if (cache.size >= maxCacheSize) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) cache.delete(firstKey);
    }

    cache.set(key, { data: promise, updatedAt: Date.now() });

    (promise as Promise<unknown>).catch(() => {
      cache.delete(key);
    });

    return promise;
  };

  return memoized as unknown as T;
};
