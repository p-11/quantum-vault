type ZeroableSecrets = Uint8Array | readonly Uint8Array[];

const toSecretsArray = (secrets: ZeroableSecrets): readonly Uint8Array[] =>
  secrets instanceof Uint8Array ? [secrets] : secrets;

const zeroSecrets = (secrets: readonly Uint8Array[]): void => {
  for (const secret of secrets) {
    secret.fill(0);
  }
};

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return typeof Reflect.get(value, 'then') === 'function';
};

export function withZeroed<T>(secrets: ZeroableSecrets, fn: () => T): T;
export function withZeroed<T>(
  secrets: ZeroableSecrets,
  fn: () => Promise<T>
): Promise<T>;
export function withZeroed<T>(
  secrets: ZeroableSecrets,
  fn: () => T | Promise<T>
): T | Promise<T> {
  const normalizedSecrets = toSecretsArray(secrets);

  try {
    const result = fn();
    if (isPromiseLike(result)) {
      return Promise.resolve(result).finally(() =>
        zeroSecrets(normalizedSecrets)
      );
    }

    zeroSecrets(normalizedSecrets);
    return result;
  } catch (error) {
    zeroSecrets(normalizedSecrets);
    throw error;
  }
}
