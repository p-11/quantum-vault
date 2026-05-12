import {
  match,
  matchDiscriminatedUnion,
  matchRecordUnion,
  getDiscriminatedUnionValue,
  getRecordUnionKey,
  getRecordUnionValue
} from '@/lib/match';

describe('match', () => {
  it('calls the handler for the matching key and returns its value', () => {
    const result = match('b' as 'a' | 'b' | 'c', {
      a: () => 1,
      b: () => 2,
      c: () => 3
    });
    expect(result).toBe(2);
  });

  it('calls every handler exactly once for its key', () => {
    const called: string[] = [];
    match('x' as 'x' | 'y', {
      x: () => {
        called.push('x');
        return 'x-result';
      },
      y: () => {
        called.push('y');
        return 'y-result';
      }
    });
    expect(called).toEqual(['x']);
  });

  it('works with number keys', () => {
    const result = match(2 as 1 | 2 | 3, {
      1: () => 'one',
      2: () => 'two',
      3: () => 'three'
    });
    expect(result).toBe('two');
  });

  it('returns the handler return value directly', () => {
    const obj = { nested: true };
    const result = match('a' as 'a' | 'b', {
      a: () => obj,
      b: () => ({ nested: false })
    });
    expect(result).toBe(obj);
  });

  it('throws when a runtime key has no matching handler', () => {
    const missing = 'missing' as const;
    expect(() =>
      match(missing, {} as Record<typeof missing, () => string>)
    ).toThrow('Unhandled case "missing"');
  });
});

describe('matchRecordUnion', () => {
  it('dispatches on the single key of a record union member', () => {
    type Chain = { evm: string } | { solana: string } | { bitcoin: string };
    const value: Chain = { solana: 'mainnet' };

    const result = matchRecordUnion(value, {
      evm: v => `evm:${v}`,
      solana: v => `solana:${v}`,
      bitcoin: v => `bitcoin:${v}`
    });

    expect(result).toBe('solana:mainnet');
  });

  it('passes the value of the matching key to the handler', () => {
    const value: { count: number } | { label: string } = { count: 42 };

    const result = matchRecordUnion(value, {
      count: n => n * 2,
      label: s => s.length
    });

    expect(result).toBe(84);
  });

  it('returns the handler result without extra wrapping', () => {
    const value: { a: boolean } | { b: boolean } = { b: true };

    const result = matchRecordUnion(value, {
      a: v => !v,
      b: v => !v
    });

    expect(result).toBe(false);
  });

  it('throws when the record union does not have exactly one key', () => {
    expect(() =>
      matchRecordUnion({ a: 1, b: 2 } as { a: number } | { b: number }, {
        a: n => n,
        b: n => n
      })
    ).toThrow('Expected single-key record union, got 2');
  });
});

describe('matchDiscriminatedUnion', () => {
  type Action =
    | { kind: 'send'; payload: { to: string; amount: number } }
    | { kind: 'receive'; payload: { from: string } }
    | { kind: 'swap'; payload: { tokenIn: string; tokenOut: string } };

  it('dispatches on the discriminant key and passes the payload', () => {
    const action: Action = {
      kind: 'send',
      payload: { to: 'alice', amount: 100 }
    };

    const result = matchDiscriminatedUnion(action, 'kind', 'payload', {
      send: p => `send:${p.to}:${p.amount}`,
      receive: p => `receive:${p.from}`,
      swap: p => `swap:${p.tokenIn}:${p.tokenOut}`
    });

    expect(result).toBe('send:alice:100');
  });

  it('provides the narrowed payload type for each handler', () => {
    const action: Action = { kind: 'receive', payload: { from: 'bob' } };

    const result = matchDiscriminatedUnion(action, 'kind', 'payload', {
      send: p => p.amount,
      receive: p => p.from.toUpperCase(),
      swap: p => p.tokenIn
    });

    expect(result).toBe('BOB');
  });

  it('handles discriminants with complex payloads correctly', () => {
    const action: Action = {
      kind: 'swap',
      payload: { tokenIn: 'ETH', tokenOut: 'USDC' }
    };

    const result = matchDiscriminatedUnion(action, 'kind', 'payload', {
      send: () => 'wrong',
      receive: () => 'wrong',
      swap: p => [p.tokenIn, p.tokenOut].join('-')
    });

    expect(result).toBe('ETH-USDC');
  });

  it('throws when a runtime discriminant has no handler', () => {
    expect(() =>
      matchDiscriminatedUnion(
        { kind: 'unexpected', payload: {} } as unknown as Action,
        'kind',
        'payload',
        {
          send: () => 'send',
          receive: () => 'receive',
          swap: () => 'swap'
        }
      )
    ).toThrow('Unhandled case "unexpected"');
  });
});

describe('getDiscriminatedUnionValue', () => {
  type Status =
    | { state: 'ok'; data: string }
    | { state: 'err'; data: Error }
    | { state: 'pending'; data: null };

  it('returns the value for a matching case', () => {
    const value: Status = { state: 'ok', data: 'success' };
    const result = getDiscriminatedUnionValue(value, 'state', 'data', 'ok');
    expect(result).toBe('success');
  });

  it('throws when the actual case does not match the expected case', () => {
    const value: Status = { state: 'err', data: new Error('boom') };
    expect(() =>
      getDiscriminatedUnionValue(value, 'state', 'data', 'ok')
    ).toThrow('Expected case "ok", but got "err"');
  });

  it('includes both expected and actual case names in the error message', () => {
    const value: Status = { state: 'pending', data: null };
    expect(() =>
      getDiscriminatedUnionValue(value, 'state', 'data', 'err')
    ).toThrow('"err"');
  });

  it('returns null when the matched value is null', () => {
    const value: Status = { state: 'pending', data: null };
    const result = getDiscriminatedUnionValue(
      value,
      'state',
      'data',
      'pending'
    );
    expect(result).toBeNull();
  });
});

describe('getRecordUnionKey', () => {
  it('returns the single key from a record union member', () => {
    const record = { solana: 'mainnet' };
    expect(getRecordUnionKey(record)).toBe('solana');
  });

  it('returns the first key when the object has one entry', () => {
    const record = { evm: { chainId: 1 } };
    expect(getRecordUnionKey(record)).toBe('evm');
  });

  it('works for records with numeric-like string keys', () => {
    const record = { bitcoin: true };
    expect(getRecordUnionKey(record)).toBe('bitcoin');
  });

  it('throws when the object has more than one key', () => {
    expect(() => getRecordUnionKey({ a: 1, b: 2 })).toThrow(
      'Expected single-key record union, got 2'
    );
  });
});

describe('getRecordUnionValue', () => {
  it('returns the value at the first key when called without a key argument', () => {
    const record = { label: 'hello' };
    expect(getRecordUnionValue(record)).toBe('hello');
  });

  it('returns the value for a specified key', () => {
    const record = { count: 42 };
    expect(getRecordUnionValue(record, 'count')).toBe(42);
  });

  it('throws when the specified key is not present in the record', () => {
    const record = { evm: 'mainnet' };
    expect(() =>
      getRecordUnionValue(record as Record<string, unknown>, 'solana')
    ).toThrow('Key "solana" not found in record union');
  });

  it('returns an object value correctly', () => {
    const inner = { chainId: 1 };
    const record = { eth: inner };
    expect(getRecordUnionValue(record)).toBe(inner);
  });

  it('throws when called without key on a multi-key object', () => {
    expect(() => getRecordUnionValue({ a: 1, b: 2 })).toThrow(
      'Expected single-key record union, got 2'
    );
  });
});
