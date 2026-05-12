import { vi } from 'vitest';
import { memoize, memoizeAsync } from '@/lib/memoize';

describe('memoize', () => {
  it('returns cached result on repeated calls with the same args', () => {
    const func = vi.fn((n: number) => n * 2);
    const memoized = memoize(func);

    const first = memoized(5);
    const second = memoized(5);

    expect(first).toBe(10);
    expect(second).toBe(10);
    expect(func).toHaveBeenCalledTimes(1);
  });

  it('recomputes when called with different args', () => {
    const func = vi.fn((n: number) => n * 2);
    const memoized = memoize(func);

    expect(memoized(3)).toBe(6);
    expect(memoized(7)).toBe(14);
    expect(func).toHaveBeenCalledTimes(2);
  });

  it('uses a custom getKey function when provided', () => {
    const func = vi.fn((obj: { id: number }) => obj.id * 10);
    const memoized = memoize(func, obj => String(obj.id));

    const first = memoized({ id: 1 });
    const second = memoized({ id: 1 });

    expect(first).toBe(10);
    expect(second).toBe(10);
    expect(func).toHaveBeenCalledTimes(1);
  });

  it('evicts the oldest entry when the cache exceeds 1000 entries', () => {
    const func = vi.fn((n: number) => n);
    const memoized = memoize(func);

    for (let i = 0; i < 1000; i++) {
      memoized(i);
    }
    expect(func).toHaveBeenCalledTimes(1000);

    memoized(1000);
    expect(func).toHaveBeenCalledTimes(1001);

    memoized(0);
    expect(func).toHaveBeenCalledTimes(1002);
  });
});

describe('memoizeAsync', () => {
  it('caches a resolved promise and returns it on subsequent calls', async () => {
    const func = vi.fn().mockResolvedValue('data');
    const memoized = memoizeAsync(func);

    const first = await memoized();
    const second = await memoized();

    expect(first).toBe('data');
    expect(second).toBe('data');
    expect(func).toHaveBeenCalledTimes(1);
  });

  it('evicts the cache entry when the promise rejects', async () => {
    const func = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('recovered');
    const memoized = memoizeAsync(func);

    await expect(memoized()).rejects.toThrow('fail');

    await new Promise(r => setTimeout(r, 0));

    const result = await memoized();
    expect(result).toBe('recovered');
    expect(func).toHaveBeenCalledTimes(2);
  });

  it('returns a fresh result after cacheTimeMs expires', async () => {
    vi.useFakeTimers();

    const func = vi.fn().mockResolvedValue('fresh');
    const memoized = memoizeAsync(func, { cacheTimeMs: 500 });

    await memoized();
    expect(func).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(600);

    const result = await memoized();
    expect(result).toBe('fresh');
    expect(func).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('returns cached result before cacheTimeMs expires', async () => {
    vi.useFakeTimers();

    const func = vi.fn().mockResolvedValue('cached');
    const memoized = memoizeAsync(func, { cacheTimeMs: 1000 });

    await memoized();
    vi.advanceTimersByTime(400);
    await memoized();

    expect(func).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('uses a custom getKey to differentiate calls', async () => {
    const func = vi.fn((id: number) => Promise.resolve(id * 100));
    const memoized = memoizeAsync(func, { getKey: (id: number) => String(id) });

    const a = await memoized(1);
    const b = await memoized(2);
    const c = await memoized(1);

    expect(a).toBe(100);
    expect(b).toBe(200);
    expect(c).toBe(100);
    expect(func).toHaveBeenCalledTimes(2);
  });

  it('evicts oldest entries when maxCacheSize is reached', async () => {
    const func = vi.fn((id: number) => Promise.resolve(id));
    const memoized = memoizeAsync(func, { maxCacheSize: 2 });

    await memoized(1);
    await memoized(2);
    await memoized(3);
    await memoized(1);

    expect(func).toHaveBeenCalledTimes(4);
  });

  it('throws when maxCacheSize is less than 1', () => {
    expect(() => memoizeAsync(async () => 'x', { maxCacheSize: 0 })).toThrow(
      'Expected maxCacheSize >= 1, got 0'
    );
  });
});
