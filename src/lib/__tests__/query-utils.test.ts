import {
  mergeQueries,
  transformQueryData,
  combineQueries
} from '@/lib/query-utils';
import type { Query } from '@/lib/query';

const successQuery = <T>(data: T): Query<T> => ({
  data,
  isPending: false,
  error: null
});

const pendingQuery = <T>(): Query<T> => ({
  data: undefined,
  isPending: true,
  error: null
});

const errorQuery = <T>(error: unknown): Query<T> => ({
  data: undefined,
  isPending: false,
  error
});

describe('mergeQueries', () => {
  it('merges data from all queries when all succeed', () => {
    const result = mergeQueries({
      name: successQuery('Alice'),
      age: successQuery(30)
    });

    expect(result.data).toEqual({ name: 'Alice', age: 30 });
    expect(result.isPending).toBe(false);
    expect(result.error).toBeNull();
  });

  it('sets isPending to true when any query is pending', () => {
    const result = mergeQueries({
      name: successQuery('Alice'),
      age: pendingQuery<number>()
    });

    expect(result.isPending).toBe(true);
    expect(result.data).toBeUndefined();
  });

  it('propagates the first error when any query has an error', () => {
    const err = new Error('fetch failed');
    const result = mergeQueries({
      name: successQuery('Alice'),
      age: errorQuery<number>(err)
    });

    expect(result.error).toBe(err);
    expect(result.data).toBeUndefined();
    expect(result.isPending).toBe(false);
  });

  it('prefers pending over error when both are present', () => {
    const err = new Error('oops');
    const result = mergeQueries({
      a: pendingQuery<string>(),
      b: errorQuery<number>(err)
    });

    expect(result.isPending).toBe(true);
    expect(result.data).toBeUndefined();
  });

  it('treats falsy non-null errors as errors', () => {
    const result = mergeQueries({
      name: successQuery('Alice'),
      age: errorQuery<number>('')
    });

    expect(result.error).toBe('');
    expect(result.data).toBeUndefined();
  });
});

describe('transformQueryData', () => {
  it('applies the transform function when data is present', () => {
    const query = successQuery(5);
    const result = transformQueryData(query, n => n * 2);

    expect(result.data).toBe(10);
    expect(result.isPending).toBe(false);
    expect(result.error).toBeNull();
  });

  it('passes through pending state without calling the transform', () => {
    const transform = vi.fn();
    const result = transformQueryData(pendingQuery<number>(), transform);

    expect(result.data).toBeUndefined();
    expect(result.isPending).toBe(true);
    expect(transform).not.toHaveBeenCalled();
  });

  it('passes through error state without calling the transform', () => {
    const err = new Error('error');
    const transform = vi.fn();
    const result = transformQueryData(errorQuery<number>(err), transform);

    expect(result.data).toBeUndefined();
    expect(result.error).toBe(err);
    expect(transform).not.toHaveBeenCalled();
  });
});

describe('combineQueries', () => {
  it('merges queries and applies joinData when all succeed', () => {
    const result = combineQueries({
      queries: {
        x: successQuery(3),
        y: successQuery(4)
      },
      joinData: ({ x, y }) => x + y
    });

    expect(result.data).toBe(7);
    expect(result.isPending).toBe(false);
    expect(result.error).toBeNull();
  });

  it('returns undefined data when any query is pending', () => {
    const joinData = vi.fn();
    const result = combineQueries({
      queries: {
        x: successQuery(3),
        y: pendingQuery<number>()
      },
      joinData
    });

    expect(result.data).toBeUndefined();
    expect(result.isPending).toBe(true);
    expect(joinData).not.toHaveBeenCalled();
  });

  it('propagates error when any query has an error', () => {
    const err = new Error('query error');
    const result = combineQueries({
      queries: {
        x: successQuery(1),
        y: errorQuery<number>(err)
      },
      joinData: ({ x, y }) => x + y
    });

    expect(result.data).toBeUndefined();
    expect(result.error).toBe(err);
  });

  it('passes the full merged data object to joinData', () => {
    const joinData = vi.fn().mockReturnValue('joined');
    combineQueries({
      queries: {
        a: successQuery('hello'),
        b: successQuery('world')
      },
      joinData
    });

    expect(joinData).toHaveBeenCalledWith({ a: 'hello', b: 'world' });
  });
});
