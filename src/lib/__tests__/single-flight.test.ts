import { runSingleFlight } from '@/lib/single-flight';
import { vi } from 'vitest';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

const createDeferred = <T>(): Deferred<T> => {
  let resolve: (value: T) => void = () => {};
  let reject: (error: Error) => void = () => {};

  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
};

describe('runSingleFlight', () => {
  it('returns null and does not run action when an operation is already in flight', () => {
    const inFlightRequest = Promise.resolve('in-flight');
    const inFlightRef = { current: inFlightRequest };
    const action = vi.fn(async () => 'next');

    const result = runSingleFlight({
      inFlightRef,
      action
    });

    expect(result).toBeNull();
    expect(action).not.toHaveBeenCalled();
    expect(inFlightRef.current).toBe(inFlightRequest);
  });

  it('clears the in-flight ref after a successful operation', async () => {
    const deferred = createDeferred<string>();
    const inFlightRef: { current: Promise<string> | null } = { current: null };
    const action = vi.fn(() => deferred.promise);

    const request = runSingleFlight({
      inFlightRef,
      action
    });

    expect(request).toBe(deferred.promise);
    expect(inFlightRef.current).toBe(deferred.promise);

    deferred.resolve('ok');

    await expect(deferred.promise).resolves.toBe('ok');
    await Promise.resolve();

    expect(inFlightRef.current).toBeNull();
  });

  it('clears the in-flight ref after a failed operation', async () => {
    const deferred = createDeferred<string>();
    const inFlightRef: { current: Promise<string> | null } = { current: null };
    const action = vi.fn(() => deferred.promise);

    const request = runSingleFlight({
      inFlightRef,
      action
    });
    expect(request).toBe(deferred.promise);

    const rejectionExpectation = expect(request).rejects.toThrow('boom');

    deferred.reject(new Error('boom'));

    await rejectionExpectation;
    await Promise.resolve();

    expect(inFlightRef.current).toBeNull();
  });

  it('does not clear a newer in-flight request when an older one settles', async () => {
    const firstDeferred = createDeferred<string>();
    const secondRequest = Promise.resolve('second');
    const inFlightRef: { current: Promise<string> | null } = { current: null };
    const action = vi.fn(() => firstDeferred.promise);

    runSingleFlight({
      inFlightRef,
      action
    });

    inFlightRef.current = secondRequest;

    firstDeferred.resolve('first');

    await expect(firstDeferred.promise).resolves.toBe('first');
    await Promise.resolve();

    expect(inFlightRef.current).toBe(secondRequest);
  });
});
