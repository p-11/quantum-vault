import { pipe } from '@/lib/pipe';

describe('pipe', () => {
  it('applies a single function to the initial value', () => {
    const result = pipe(5, n => n * 2);
    expect(result).toBe(10);
  });

  it('composes two functions left-to-right', () => {
    const result = pipe(
      3,
      n => n + 1,
      n => n * 4
    );
    expect(result).toBe(16);
  });

  it('composes three functions left-to-right', () => {
    const result = pipe(
      'hello',
      s => s.toUpperCase(),
      s => `${s}!`,
      s => s.length
    );
    expect(result).toBe(6);
  });

  it('composes four functions left-to-right', () => {
    const result = pipe(
      2,
      n => n + 3,
      n => n * 2,
      n => n - 1,
      n => String(n)
    );
    expect(result).toBe('9');
  });

  it('passes the output of each function as the input to the next', () => {
    const calls: number[] = [];
    pipe(
      1,
      n => {
        calls.push(n);
        return n + 10;
      },
      n => {
        calls.push(n);
        return n + 100;
      },
      n => {
        calls.push(n);
        return n;
      }
    );
    expect(calls).toEqual([1, 11, 111]);
  });
});
