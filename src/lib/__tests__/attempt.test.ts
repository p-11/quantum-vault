import { attempt, withFallback } from '@/lib/attempt';

describe('attempt (sync fn overload)', () => {
  it('returns { data } when the function succeeds', () => {
    const result = attempt(() => 42);
    expect(result).toEqual({ data: 42 });
  });

  it('returns { data } when the function returns a string', () => {
    const result = attempt(() => 'hello');
    expect(result).toEqual({ data: 'hello' });
  });

  it('returns { data: null } when the function returns null', () => {
    const result = attempt(() => null);
    expect(result).toEqual({ data: null });
  });

  it('returns { data: false } when the function returns false', () => {
    const result = attempt(() => false);
    expect(result).toEqual({ data: false });
  });

  it('returns { error } when the function throws an Error', () => {
    const err = new Error('boom');
    const result = attempt(() => {
      throw err;
    });
    expect(result).toEqual({ error: err });
  });

  it('returns { error } when the function throws a string', () => {
    const result = attempt(() => {
      throw 'oops';
    });
    expect(result).toEqual({ error: 'oops' });
  });

  it('returns { error } when the function throws undefined', () => {
    const result = attempt(() => {
      throw undefined;
    });
    expect(result).toEqual({ error: undefined });
  });

  it('does not have a data property when an error occurred', () => {
    const result = attempt(() => {
      throw new Error('fail');
    });
    expect('data' in result).toBe(false);
  });

  it('does not have an error property when successful', () => {
    const result = attempt(() => 1);
    expect('error' in result).toBe(false);
  });
});

describe('attempt (async fn overload)', () => {
  it('resolves to { data } when the async function resolves', async () => {
    const result = await attempt(async () => 'resolved');
    expect(result).toEqual({ data: 'resolved' });
  });

  it('resolves to { data: 0 } when the async function resolves with 0', async () => {
    const result = await attempt(async () => 0);
    expect(result).toEqual({ data: 0 });
  });

  it('resolves to { error } when the async function rejects with an Error', async () => {
    const err = new Error('async fail');
    const result = await attempt(async () => {
      throw err;
    });
    expect(result).toEqual({ error: err });
  });

  it('resolves to { error } when the async function rejects with a plain value', async () => {
    const result = await attempt(async () => {
      throw 'string rejection';
    });
    expect(result).toEqual({ error: 'string rejection' });
  });

  it('does not have a data property on async rejection', async () => {
    const result = await attempt(async () => {
      throw new Error('x');
    });
    expect('data' in result).toBe(false);
  });
});

describe('attempt (promise overload)', () => {
  it('resolves to { data } when the promise resolves', async () => {
    const result = await attempt(Promise.resolve(99));
    expect(result).toEqual({ data: 99 });
  });

  it('resolves to { error } when the promise rejects', async () => {
    const err = new Error('rejected');
    const result = await attempt(Promise.reject(err));
    expect(result).toEqual({ error: err });
  });

  it('resolves to { data: undefined } when the promise resolves with undefined', async () => {
    const result = await attempt(Promise.resolve(undefined));
    expect(result).toEqual({ data: undefined });
  });

  it('resolves to { data: null } when the promise resolves with null', async () => {
    const result = await attempt(Promise.resolve(null));
    expect(result).toEqual({ data: null });
  });
});

describe('withFallback (sync overload)', () => {
  it('returns data when the result is a success', () => {
    const result = attempt(() => 'value');
    expect(withFallback(result, 'default')).toBe('value');
  });

  it('returns the fallback when the result is a failure', () => {
    const result = attempt(() => {
      throw new Error('fail');
    });
    expect(withFallback(result, 'fallback')).toBe('fallback');
  });

  it('returns data even when it is a falsy value like 0', () => {
    const result = attempt(() => 0);
    expect(withFallback(result, 99)).toBe(0);
  });

  it('returns data even when it is an empty string', () => {
    const result = attempt(() => '');
    expect(withFallback(result, 'default')).toBe('');
  });

  it('returns data even when it is false', () => {
    const result = attempt(() => false);
    expect(withFallback(result, true)).toBe(false);
  });

  it('returns data even when it is null', () => {
    const result = attempt(() => null);
    expect(withFallback(result, 'fallback')).toBeNull();
  });
});

describe('withFallback (async overload)', () => {
  it('resolves to data when the promise result is a success', async () => {
    const result = attempt(Promise.resolve('async value'));
    await expect(withFallback(result, 'default')).resolves.toBe('async value');
  });

  it('resolves to the fallback when the promise result is a failure', async () => {
    const result = attempt(Promise.reject(new Error('rejected')));
    await expect(withFallback(result, 'fallback')).resolves.toBe('fallback');
  });

  it('resolves to 0 when the async result data is 0', async () => {
    const result = attempt(Promise.resolve(0));
    await expect(withFallback(result, 99)).resolves.toBe(0);
  });

  it('resolves to false when the async result data is false', async () => {
    const result = attempt(Promise.resolve(false));
    await expect(withFallback(result, true)).resolves.toBe(false);
  });
});
