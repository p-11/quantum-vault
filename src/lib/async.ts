type RetryInput<T> = {
  func: () => Promise<T>;
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (err: unknown) => boolean;
};

const defaultMaxAttempts = 3;
const defaultBaseDelayMs = 1000;
const defaultMaxDelayMs = 30_000;
const jitterFactor = 0.2;
const defaultShouldRetry = () => false;

export const retry = async <T>({
  func,
  maxAttempts = defaultMaxAttempts,
  baseDelayMs = defaultBaseDelayMs,
  maxDelayMs = defaultMaxDelayMs,
  shouldRetry = defaultShouldRetry
}: RetryInput<T>): Promise<T> => {
  if (maxAttempts < 1) {
    throw new Error(`Expected maxAttempts >= 1, got ${maxAttempts}`);
  }
  if (baseDelayMs < 0) {
    throw new Error(`Expected baseDelayMs >= 0, got ${baseDelayMs}`);
  }
  if (maxDelayMs < 0) {
    throw new Error(`Expected maxDelayMs >= 0, got ${maxDelayMs}`);
  }

  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await func();
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === maxAttempts - 1;
      if (isLastAttempt || !shouldRetry(error)) throw error;

      const exponentialDelay = Math.min(
        baseDelayMs * Math.pow(2, attempt),
        maxDelayMs
      );
      const jitter = exponentialDelay * jitterFactor * Math.random();
      await new Promise(r => setTimeout(r, exponentialDelay + jitter));
    }
  }

  throw lastError;
};

type CoalesceOptions<Args extends unknown[]> = {
  getKey?: (...args: Args) => string;
  shouldCoalesce?: (...args: Args) => boolean;
};

export const withInFlightCoalescer = <
  T extends (...args: never[]) => Promise<unknown>
>(
  resolver: T,
  options?: CoalesceOptions<Parameters<T>>
): T => {
  const inFlight = new Map<string, ReturnType<T>>();
  const getKey =
    options?.getKey ?? ((...args: unknown[]) => JSON.stringify(args));

  return ((...args: Parameters<T>) => {
    if (options?.shouldCoalesce && !options.shouldCoalesce(...args)) {
      return resolver(...args);
    }

    const key = getKey(...args);
    const existing = inFlight.get(key);
    if (existing) return existing;

    const promise = resolver(...args).finally(() => {
      inFlight.delete(key);
    }) as ReturnType<T>;

    inFlight.set(key, promise);
    return promise;
  }) as T;
};

export const ignorePromiseOutcome = async <T>(
  promise: Promise<T>
): Promise<void> => {
  try {
    await promise;
  } catch {
    // Fire-and-forget - errors intentionally swallowed
  }
};

export const asyncFallbackChain = async <T>(
  ...functions: Array<() => Promise<T>>
): Promise<T> => {
  if (functions.length === 0) {
    throw new Error('Expected at least one function, got empty array');
  }

  try {
    return await functions[0]();
  } catch (error) {
    if (functions.length <= 1) throw error;
    return asyncFallbackChain(...functions.slice(1));
  }
};

export const chainPromises = async <T>(
  generators: Iterable<() => Promise<T>>
): Promise<T[]> => {
  const results: T[] = [];
  for (const generator of generators) {
    results.push(await generator());
  }
  return results;
};

export const isPromise = <T>(value: unknown): value is Promise<T> =>
  value !== null &&
  typeof value === 'object' &&
  'then' in value &&
  typeof value.then === 'function';
