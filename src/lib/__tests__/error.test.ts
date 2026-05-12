import {
  extractErrorMsg,
  isInError,
  prefixErrorWith,
  transformError,
  assertFetchResponse
} from '@/lib/error';

describe('extractErrorMsg', () => {
  it('returns the message property from an Error instance', () => {
    expect(extractErrorMsg(new Error('something went wrong'))).toBe(
      'something went wrong'
    );
  });

  it('returns a plain string directly', () => {
    expect(extractErrorMsg('plain error')).toBe('plain error');
  });

  it('returns a number converted to string', () => {
    expect(extractErrorMsg(404)).toBe('404');
  });

  it('returns a boolean converted to string', () => {
    expect(extractErrorMsg(false)).toBe('false');
  });

  it('extracts message from a plain object with a message property', () => {
    expect(extractErrorMsg({ message: 'object error' })).toBe('object error');
  });

  it('recursively extracts message when the message property is itself an Error', () => {
    const inner = new Error('inner message');
    const outer = { message: inner };
    expect(extractErrorMsg(outer)).toBe('inner message');
  });

  it('serializes null via JSON.stringify', () => {
    expect(extractErrorMsg(null)).toBe('null');
  });

  it('returns undefined for undefined input (JSON.stringify edge case)', () => {
    expect(extractErrorMsg(undefined)).toBeUndefined();
  });

  it('returns "Unknown Error" when recursion exceeds the depth limit', () => {
    const deep: Record<string, unknown> = {};
    let current = deep;
    for (let i = 0; i < 10; i++) {
      const next: Record<string, unknown> = {};
      current.message = next;
      current = next;
    }
    expect(extractErrorMsg(deep)).toBe('Unknown Error');
  });

  it('serializes a plain object without a message property via JSON.stringify', () => {
    const result = extractErrorMsg({ code: 42, reason: 'timeout' });
    expect(result).toBe(JSON.stringify({ code: 42, reason: 'timeout' }));
  });

  it('returns "Unknown Error" for circular objects that cannot be JSON-stringified', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(extractErrorMsg(circular)).toBe('Unknown Error');
  });
});

describe('isInError', () => {
  it('returns true when the error message contains the substring', () => {
    expect(isInError(new Error('network timeout'), 'timeout')).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(isInError(new Error('Network Timeout'), 'timeout')).toBe(true);
    expect(isInError(new Error('TIMEOUT'), 'timeout')).toBe(true);
  });

  it('returns false when the error message does not contain the substring', () => {
    expect(isInError(new Error('connection refused'), 'timeout')).toBe(false);
  });

  it('returns true when any one of multiple substrings matches', () => {
    expect(
      isInError(new Error('rate limit exceeded'), 'timeout', 'rate limit')
    ).toBe(true);
  });

  it('returns false when none of the provided substrings match', () => {
    expect(
      isInError(new Error('unexpected error'), 'timeout', 'rate limit')
    ).toBe(false);
  });

  it('works with a plain string error', () => {
    expect(isInError('vault is locked', 'locked')).toBe(true);
  });

  it('returns false for an unrelated plain string error', () => {
    expect(isInError('vault is locked', 'timeout')).toBe(false);
  });
});

describe('prefixErrorWith', () => {
  it('returns a curried function', () => {
    const prefix = prefixErrorWith('Decryption failed');
    expect(typeof prefix).toBe('function');
  });

  it('creates an Error with the prefix prepended to the extracted message', () => {
    const transform = prefixErrorWith('Vault error');
    const result = transform(new Error('bad password'));
    expect(result).toBeInstanceOf(Error);
    expect(result.message).toBe('Vault error: bad password');
  });

  it('handles a plain string error', () => {
    const transform = prefixErrorWith('Parse failed');
    const result = transform('invalid JSON');
    expect(result.message).toBe('Parse failed: invalid JSON');
  });

  it('handles unknown error types by falling back to extracted message', () => {
    const transform = prefixErrorWith('Context');
    const result = transform({ message: 'deep message' });
    expect(result.message).toBe('Context: deep message');
  });

  it('each call to prefixErrorWith creates an independent transform function', () => {
    const a = prefixErrorWith('A');
    const b = prefixErrorWith('B');
    expect(a(new Error('err')).message).toBe('A: err');
    expect(b(new Error('err')).message).toBe('B: err');
  });
});

describe('transformError', () => {
  it('resolves to the value when the promise resolves', async () => {
    const result = await transformError(
      Promise.resolve('ok'),
      () => new Error('should not reach')
    );
    expect(result).toBe('ok');
  });

  it('throws the transformed error when the promise rejects', async () => {
    await expect(
      transformError(
        Promise.reject(new Error('original')),
        () => new Error('transformed')
      )
    ).rejects.toThrow('transformed');
  });

  it('passes the original error to the transform function', async () => {
    const original = new Error('raw error');
    let received: unknown;

    await expect(
      transformError(Promise.reject(original), err => {
        received = err;
        return new Error('wrapped');
      })
    ).rejects.toThrow('wrapped');

    expect(received).toBe(original);
  });

  it('throws whatever the transform function returns', async () => {
    const customError = { code: 500, message: 'internal' };

    await expect(
      transformError(
        Promise.reject(new Error('fail')),
        () => customError as unknown as Error
      )
    ).rejects.toBe(customError);
  });

  it('resolves with a resolved value of undefined when the promise resolves with undefined', async () => {
    const result = await transformError(
      Promise.resolve(undefined),
      () => new Error('nope')
    );
    expect(result).toBeUndefined();
  });
});

describe('assertFetchResponse', () => {
  it('does not throw for an ok response', async () => {
    const response = new Response(JSON.stringify({ ok: true }), {
      status: 200
    });
    await expect(assertFetchResponse(response)).resolves.toBeUndefined();
  });

  it('throws API error message from JSON body when available', async () => {
    const response = new Response(JSON.stringify({ message: 'bad request' }), {
      status: 400,
      statusText: 'Bad Request'
    });

    await expect(assertFetchResponse(response)).rejects.toThrow('bad request');
  });

  it('falls back to HTTP status line when body is not valid JSON', async () => {
    const response = new Response('plain text', {
      status: 500,
      statusText: 'Internal Server Error'
    });

    await expect(assertFetchResponse(response)).rejects.toThrow(
      'HTTP 500 Internal Server Error'
    );
  });
});
