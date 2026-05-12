import type { Query } from './query';

export const mergeQueries = <T extends Record<string, unknown>>(queries: {
  [K in keyof T]: Query<T[K]>;
}): Query<T> => {
  const entries = Object.entries(queries) as [string, Query<unknown>][];

  const isPending = entries.some(([, q]) => q.isPending);
  const error = entries.find(([, q]) => q.error !== null)?.[1].error ?? null;
  const hasError = error !== null;

  const data =
    isPending || hasError
      ? undefined
      : (Object.fromEntries(entries.map(([key, q]) => [key, q.data])) as T);

  return { data, isPending, error };
};

export const transformQueryData = <T, R>(
  query: Query<T>,
  transform: (data: T) => R
): Query<R> => {
  const data = query.data !== undefined ? transform(query.data) : undefined;

  return { data, isPending: query.isPending, error: query.error };
};

type CombineQueriesInput<T extends Record<string, unknown>, R> = {
  queries: { [K in keyof T]: Query<T[K]> };
  joinData: (data: T) => R;
};

export const combineQueries = <T extends Record<string, unknown>, R>({
  queries,
  joinData
}: CombineQueriesInput<T, R>): Query<R> => {
  const merged = mergeQueries(queries);
  const data = merged.data !== undefined ? joinData(merged.data) : undefined;

  return { data, isPending: merged.isPending, error: merged.error };
};
