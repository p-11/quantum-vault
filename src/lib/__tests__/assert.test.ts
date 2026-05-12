import { ensurePresent, ensureDefined, isOneOf } from '@/lib/assert';

describe('ensurePresent', () => {
  it('returns the value when it is a non-null, non-undefined truthy value', () => {
    expect(ensurePresent('hello', 'greeting')).toBe('hello');
  });

  it('returns the value when it is a non-empty object', () => {
    const obj = { id: 1 };
    expect(ensurePresent(obj, 'record')).toBe(obj);
  });

  it('returns 0 because zero is present even though it is falsy', () => {
    expect(ensurePresent(0, 'count')).toBe(0);
  });

  it('returns an empty string because it is present even though it is falsy', () => {
    expect(ensurePresent('', 'label')).toBe('');
  });

  it('returns false because boolean false is present', () => {
    expect(ensurePresent(false, 'flag')).toBe(false);
  });

  it('throws when the value is null', () => {
    expect(() => ensurePresent(null, 'wallet')).toThrow(
      'Expected wallet to be present, got null'
    );
  });

  it('throws when the value is undefined', () => {
    expect(() => ensurePresent(undefined, 'account')).toThrow(
      'Expected account to be present, got undefined'
    );
  });

  it('includes the valueName in the thrown error message', () => {
    expect(() => ensurePresent(null, 'vault address')).toThrow('vault address');
  });
});

describe('ensureDefined', () => {
  it('returns the value when it is a string', () => {
    expect(ensureDefined('value', 'field')).toBe('value');
  });

  it('returns the value when it is a number', () => {
    expect(ensureDefined(42, 'amount')).toBe(42);
  });

  it('returns null because null is defined (it is not undefined)', () => {
    expect(ensureDefined(null, 'nullable field')).toBeNull();
  });

  it('returns false because false is a defined value', () => {
    expect(ensureDefined(false, 'enabled')).toBe(false);
  });

  it('returns 0 because 0 is a defined value', () => {
    expect(ensureDefined(0, 'index')).toBe(0);
  });

  it('throws when the value is undefined', () => {
    expect(() => ensureDefined(undefined, 'chainId')).toThrow(
      'Expected chainId to be defined, got undefined'
    );
  });

  it('includes the valueName in the thrown error message', () => {
    expect(() => ensureDefined(undefined, 'selected token')).toThrow(
      'selected token'
    );
  });
});

describe('isOneOf', () => {
  const chainKinds = ['evm', 'solana', 'bitcoin'] as const;

  it('returns true when the item is in the array', () => {
    expect(isOneOf('evm', chainKinds)).toBe(true);
  });

  it('returns true for every item in the array', () => {
    expect(isOneOf('solana', chainKinds)).toBe(true);
    expect(isOneOf('bitcoin', chainKinds)).toBe(true);
  });

  it('returns false when the item is not in the array', () => {
    expect(isOneOf('cosmos', chainKinds)).toBe(false);
  });

  it('returns false for an empty string that is not in the array', () => {
    expect(isOneOf('', chainKinds)).toBe(false);
  });

  it('returns false for undefined when not included in the array', () => {
    expect(isOneOf(undefined, chainKinds)).toBe(false);
  });

  it('works with number arrays', () => {
    const valid = [1, 2, 3] as const;
    expect(isOneOf(2, valid)).toBe(true);
    expect(isOneOf(4, valid)).toBe(false);
  });

  it('works with an empty readonly array and always returns false', () => {
    const empty = [] as const;
    expect(isOneOf('anything', empty)).toBe(false);
  });

  it('acts as a type guard narrowing the type to T', () => {
    const value: unknown = 'evm';
    if (isOneOf(value, chainKinds)) {
      expect(value).toBe('evm');
    } else {
      throw new Error('expected type guard to pass');
    }
  });
});
