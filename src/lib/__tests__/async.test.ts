import { vi } from 'vitest';
import {
  retry,
  withInFlightCoalescer,
  ignorePromiseOutcome,
  asyncFallbackChain,
  chainPromises,
  isPromise
} from '@/lib/async';

describe('retry', () => {
  it('resolves on the first successful attempt', async () => {
    const func = vi.fn().mockResolvedValue('ok');
    const result = await retry({ func });
    expect(result).toBe('ok');
    expect(func).toHaveBeenCalledTimes(1);
  });

  it('retries after a failure and eventually resolves', async () => {
    vi.useFakeTimers();
    const func = vi
      .fn()
      .mockRejectedValueOnce(new Error('first fail'))
      .mockResolvedValue('success');

    const promise = retry({
      func,
      maxAttempts: 3,
      baseDelayMs: 100,
      shouldRetry: () => true
    });
    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;

    expect(result).toBe('success');
    expect(func).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('throws the last error after exhausting all attempts', async () => {
    const error = new Error('always fails');
    const func = vi.fn().mockRejectedValue(error);

    await expect(
      retry({
        func,
        maxAttempts: 3,
        baseDelayMs: 1,
        maxDelayMs: 1,
        shouldRetry: () => true
      })
    ).rejects.toThrow('always fails');
    expect(func).toHaveBeenCalledTimes(3);
  });

  it('stops retrying when shouldRetry returns false', async () => {
    const error = new Error('unretryable');
    const func = vi.fn().mockRejectedValue(error);
    const shouldRetry = vi.fn().mockReturnValue(false);

    await expect(retry({ func, maxAttempts: 5, shouldRetry })).rejects.toThrow(
      'unretryable'
    );
    expect(func).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledWith(error);
  });

  it('does not retry by default', async () => {
    const error = new Error('default no retry');
    const func = vi.fn().mockRejectedValue(error);

    await expect(retry({ func, maxAttempts: 5 })).rejects.toThrow(
      'default no retry'
    );
    expect(func).toHaveBeenCalledTimes(1);
  });

  it('throws immediately when maxAttempts is less than 1', async () => {
    const func = vi.fn().mockResolvedValue('ok');
    await expect(retry({ func, maxAttempts: 0 })).rejects.toThrow(
      'Expected maxAttempts >= 1, got 0'
    );
    expect(func).not.toHaveBeenCalled();
  });

  it('throws immediately when baseDelayMs is negative', async () => {
    const func = vi.fn().mockResolvedValue('ok');
    await expect(retry({ func, baseDelayMs: -1 })).rejects.toThrow(
      'Expected baseDelayMs >= 0, got -1'
    );
    expect(func).not.toHaveBeenCalled();
  });

  it('throws immediately when maxDelayMs is negative', async () => {
    const func = vi.fn().mockResolvedValue('ok');
    await expect(retry({ func, maxDelayMs: -1 })).rejects.toThrow(
      'Expected maxDelayMs >= 0, got -1'
    );
    expect(func).not.toHaveBeenCalled();
  });
});

describe('withInFlightCoalescer', () => {
  it('coalesces concurrent calls with the same key into one request', async () => {
    const resolver = vi
      .fn()
      .mockImplementation(() => Promise.resolve('shared-result'));
    const coalesced = withInFlightCoalescer(resolver);

    const [a, b, c] = await Promise.all([
      coalesced('key'),
      coalesced('key'),
      coalesced('key')
    ]);

    expect(a).toBe('shared-result');
    expect(b).toBe('shared-result');
    expect(c).toBe('shared-result');
    expect(resolver).toHaveBeenCalledTimes(1);
  });

  it('makes separate calls for different keys', async () => {
    const resolver = vi
      .fn()
      .mockImplementation((key: string) => Promise.resolve(key));
    const coalesced = withInFlightCoalescer(resolver);

    const [a, b] = await Promise.all([coalesced('key-a'), coalesced('key-b')]);

    expect(a).toBe('key-a');
    expect(b).toBe('key-b');
    expect(resolver).toHaveBeenCalledTimes(2);
  });

  it('calls the resolver again after the in-flight promise resolves', async () => {
    let callCount = 0;
    const resolver = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve(`result-${callCount}`);
    });
    const coalesced = withInFlightCoalescer(resolver);

    const first = await coalesced('key');
    const second = await coalesced('key');

    expect(first).toBe('result-1');
    expect(second).toBe('result-2');
    expect(resolver).toHaveBeenCalledTimes(2);
  });
});

describe('ignorePromiseOutcome', () => {
  it('resolves to void when the wrapped promise resolves', async () => {
    const result = await ignorePromiseOutcome(Promise.resolve('value'));
    expect(result).toBeUndefined();
  });

  it('resolves to void when the wrapped promise rejects', async () => {
    const result = await ignorePromiseOutcome(
      Promise.reject(new Error('fail'))
    );
    expect(result).toBeUndefined();
  });
});

describe('asyncFallbackChain', () => {
  it('returns the result of the first function when it succeeds', async () => {
    const first = vi.fn().mockResolvedValue('first');
    const second = vi.fn().mockResolvedValue('second');

    const result = await asyncFallbackChain(first, second);
    expect(result).toBe('first');
    expect(second).not.toHaveBeenCalled();
  });

  it('falls back to the next function when the first fails', async () => {
    const first = vi.fn().mockRejectedValue(new Error('first failed'));
    const second = vi.fn().mockResolvedValue('fallback');

    const result = await asyncFallbackChain(first, second);
    expect(result).toBe('fallback');
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('throws when all functions fail', async () => {
    const first = vi.fn().mockRejectedValue(new Error('first failed'));
    const second = vi.fn().mockRejectedValue(new Error('second failed'));

    await expect(asyncFallbackChain(first, second)).rejects.toThrow(
      'second failed'
    );
  });

  it('throws when called with an empty array', async () => {
    await expect(asyncFallbackChain()).rejects.toThrow(
      'Expected at least one function, got empty array'
    );
  });
});

describe('chainPromises', () => {
  it('executes generators sequentially and collects all results', async () => {
    const order: number[] = [];
    const generators = [1, 2, 3].map(
      n => () =>
        new Promise<number>(resolve => {
          order.push(n);
          resolve(n * 10);
        })
    );

    const results = await chainPromises(generators);

    expect(results).toEqual([10, 20, 30]);
    expect(order).toEqual([1, 2, 3]);
  });

  it('returns an empty array for an empty iterable', async () => {
    const results = await chainPromises([]);
    expect(results).toEqual([]);
  });
});

describe('isPromise', () => {
  it('returns true for a native Promise', () => {
    expect(isPromise(Promise.resolve())).toBe(true);
  });

  it('returns true for a thenable object', () => {
    const thenable = { then: () => {} };
    expect(isPromise(thenable)).toBe(true);
  });

  it('returns false for a plain object', () => {
    expect(isPromise({ value: 1 })).toBe(false);
  });

  it('returns false for a string', () => {
    expect(isPromise('not a promise')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isPromise(null)).toBe(false);
  });

  it('returns false for a function without then', () => {
    expect(isPromise(() => {})).toBe(false);
  });
});
