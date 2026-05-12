type Success<T = unknown> = { data: T; error?: never };
type Failure<E = unknown> = { data?: never; error: E };
export type Result<T = unknown, E = unknown> = Success<T> | Failure<E>;
const toSuccess = <T>(data: T): Success<T> => ({ data });
const toFailure = <E>(error: E): Failure<E> => ({ error });

export function attempt<T, E = unknown>(
  fn: () => Promise<T>
): Promise<Result<T, E>>;
export function attempt<T, E = unknown>(fn: () => T): Result<T, E>;
export function attempt<T, E = unknown>(
  promise: Promise<T>
): Promise<Result<T, E>>;
export function attempt<T, E = unknown>(
  input: Promise<T> | (() => T) | (() => Promise<T>)
): Result<T, E> | Promise<Result<T, E>> {
  if (input instanceof Promise) {
    return input.then(toSuccess).catch(error => toFailure(error as E));
  }

  try {
    const result = input();
    if (result instanceof Promise) {
      return result.then(toSuccess).catch(error => toFailure(error as E));
    }
    return toSuccess(result);
  } catch (error) {
    return toFailure(error as E);
  }
}

export function withFallback<T, E = unknown>(
  result: Result<T, E>,
  fallback: T
): T;
export function withFallback<T, E = unknown>(
  result: Promise<Result<T, E>>,
  fallback: T
): Promise<T>;
export function withFallback<T, E = unknown>(
  result: Result<T, E> | Promise<Result<T, E>>,
  fallback: T
): T | Promise<T> {
  if (result instanceof Promise) {
    return result.then(r => ('error' in r ? fallback : r.data));
  }
  return 'error' in result ? fallback : result.data;
}
