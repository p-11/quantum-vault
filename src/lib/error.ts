import { attempt, withFallback } from './attempt';

const maxRecursionDepth = 5;

export const extractErrorMsg = (err: unknown, depth = 0): string => {
  if (depth > maxRecursionDepth) return 'Unknown Error';
  if (typeof err === 'string') return err;
  if (typeof err === 'number' || typeof err === 'boolean') return String(err);
  if (err !== null && typeof err === 'object' && 'message' in err) {
    return extractErrorMsg(err.message, depth + 1);
  }
  return withFallback(
    attempt(() => JSON.stringify(err)),
    'Unknown Error'
  );
};

export const isInError = (error: unknown, ...msgs: string[]): boolean => {
  const errorMessage = extractErrorMsg(error).toLowerCase();
  return msgs.some(msg => errorMessage.includes(msg.toLowerCase()));
};

export const prefixErrorWith =
  (prefix: string) =>
  (error: unknown): Error =>
    new Error(`${prefix}: ${extractErrorMsg(error)}`);

export const transformError = async <T, E = Error>(
  promise: Promise<T>,
  transform: (error: unknown) => E
): Promise<T> => {
  const result = await attempt(promise);
  if ('error' in result) {
    throw transform(result.error);
  }
  return result.data;
};

export const assertFetchResponse = async (
  response: Response
): Promise<void> => {
  if (response.ok) return;

  const errorResult = await attempt(async () => {
    const json = await response.json();
    return extractErrorMsg(json);
  });

  const msg =
    'data' in errorResult
      ? errorResult.data
      : `HTTP ${response.status} ${response.statusText}`;

  throw new Error(msg);
};
