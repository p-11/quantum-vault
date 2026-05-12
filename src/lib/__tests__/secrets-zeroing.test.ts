import { withZeroed } from '@/lib/secrets-zeroing';
import { describe, expect, it } from 'vitest';

describe('withZeroed', () => {
  it('returns value and zeroes bytes after sync work', () => {
    const secret = Uint8Array.from([1, 2, 3]);

    const result = withZeroed(secret, () => 'ok');

    expect(result).toBe('ok');
    expect(secret).toEqual(Uint8Array.from([0, 0, 0]));
  });

  it('zeroes bytes when sync work throws', () => {
    const secret = Uint8Array.from([1, 2, 3]);

    expect(() =>
      withZeroed(secret, () => {
        throw new Error('boom');
      })
    ).toThrowError('boom');
    expect(secret).toEqual(Uint8Array.from([0, 0, 0]));
  });
});

describe('withZeroed (async)', () => {
  it('zeroes bytes only after async work completes', async () => {
    const secret = Uint8Array.from([9, 8]);
    let release: (() => void) | undefined;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });

    const resultPromise = withZeroed(secret, async () => {
      await gate;
      return 'done';
    });

    expect(secret).toEqual(Uint8Array.from([9, 8]));
    release?.();

    await expect(resultPromise).resolves.toBe('done');
    expect(secret).toEqual(Uint8Array.from([0, 0]));
  });

  it('zeroes bytes when async work rejects', async () => {
    const secret = Uint8Array.from([4, 5]);

    await expect(
      withZeroed(secret, async () => {
        throw new Error('async boom');
      })
    ).rejects.toThrowError('async boom');
    expect(secret).toEqual(Uint8Array.from([0, 0]));
  });
});

describe('withZeroed (many secrets)', () => {
  it('zeroes every provided secret', async () => {
    const first = Uint8Array.from([1, 1, 1]);
    const second = Uint8Array.from([2, 2, 2]);

    await expect(withZeroed([first, second], async () => 'ok')).resolves.toBe(
      'ok'
    );
    expect(first).toEqual(Uint8Array.from([0, 0, 0]));
    expect(second).toEqual(Uint8Array.from([0, 0, 0]));
  });
});
