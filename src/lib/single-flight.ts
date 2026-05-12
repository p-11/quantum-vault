import type { RefObject } from 'react';

type RunSingleFlightInput<T> = {
  inFlightRef: RefObject<Promise<T> | null>;
  action: () => Promise<T>;
};

/**
 * Ensures only one non-idempotent async operation runs at a time.
 * Returns null when an equivalent request is already in flight.
 */
export const runSingleFlight = <T>({
  inFlightRef,
  action
}: RunSingleFlightInput<T>): Promise<T> | null => {
  if (inFlightRef.current) {
    return null;
  }

  const request = action();

  inFlightRef.current = request;
  void request
    .finally(() => {
      if (inFlightRef.current === request) {
        inFlightRef.current = null;
      }
    })
    .catch(() => undefined);

  return request;
};
