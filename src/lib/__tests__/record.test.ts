import {
  areEqualRecords,
  getRecordKeys,
  haveEqualFields,
  mergeRecords,
  mirrorRecord,
  omit,
  pick,
  recordFromItems,
  recordFromKeys,
  recordMap,
  toEntries,
  withoutUndefinedFields
} from '@/lib/record';

describe('getRecordKeys', () => {
  it('returns an empty array for an empty record', () => {
    expect(getRecordKeys({})).toEqual([]);
  });

  it('returns the keys of a single-key record', () => {
    expect(getRecordKeys({ a: 1 })).toEqual(['a']);
  });

  it('returns all keys for a multi-key record', () => {
    const keys = getRecordKeys({ a: 1, b: 2, c: 3 });
    expect(keys.sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('recordMap', () => {
  it('returns an empty record for an empty input', () => {
    expect(recordMap({} as Record<string, number>, v => v * 2)).toEqual({});
  });

  it('transforms each value using the mapping function', () => {
    expect(recordMap({ a: 1, b: 2, c: 3 }, v => v * 2)).toEqual({
      a: 2,
      b: 4,
      c: 6
    });
  });

  it('passes the key as the second argument to the mapping function', () => {
    const result = recordMap({ x: 10, y: 20 }, (v, k) => `${k}:${v}`);
    expect(result).toEqual({ x: 'x:10', y: 'y:20' });
  });
});

describe('pick', () => {
  it('returns an empty record when picking no keys', () => {
    expect(pick({ a: 1, b: 2 }, [])).toEqual({});
  });

  it('returns only the picked keys', () => {
    expect(pick({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ a: 1, c: 3 });
  });

  it('ignores keys that are not present in the object', () => {
    const obj = { a: 1, b: 2 };
    expect(pick(obj, ['a'] as const)).toEqual({ a: 1 });
  });
});

describe('omit', () => {
  it('returns the original record when omitting no keys', () => {
    expect(omit({ a: 1, b: 2 }, [])).toEqual({ a: 1, b: 2 });
  });

  it('removes the specified keys', () => {
    expect(omit({ a: 1, b: 2, c: 3 }, ['b'])).toEqual({ a: 1, c: 3 });
  });

  it('removes multiple keys', () => {
    expect(omit({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ b: 2 });
  });

  it('does not mutate the source record', () => {
    const source = { a: 1, b: 2 };
    omit(source, ['a']);
    expect(source).toEqual({ a: 1, b: 2 });
  });
});

describe('mergeRecords', () => {
  it('returns an empty record when given no arguments', () => {
    expect(mergeRecords()).toEqual({});
  });

  it('returns a copy when given a single record', () => {
    expect(mergeRecords({ a: 1 })).toEqual({ a: 1 });
  });

  it('merges two records', () => {
    expect(mergeRecords({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });

  it('later records override earlier ones for duplicate keys', () => {
    expect(mergeRecords({ a: 1, b: 2 }, { b: 99, c: 3 })).toEqual({
      a: 1,
      b: 99,
      c: 3
    });
  });

  it('last record wins when merging three records with overlapping keys', () => {
    expect(mergeRecords({ x: 1 }, { x: 2 }, { x: 3 })).toEqual({ x: 3 });
  });
});

describe('recordFromKeys', () => {
  it('returns an empty record for an empty key array', () => {
    expect(recordFromKeys([], k => k)).toEqual({});
  });

  it('builds a record using the getValue function', () => {
    expect(recordFromKeys(['a', 'b', 'c'], k => k.toUpperCase())).toEqual({
      a: 'A',
      b: 'B',
      c: 'C'
    });
  });

  it('passes the index as the second argument to getValue', () => {
    const result = recordFromKeys(['x', 'y', 'z'], (_, i) => i);
    expect(result).toEqual({ x: 0, y: 1, z: 2 });
  });
});

describe('recordFromItems', () => {
  it('returns an empty record for an empty array', () => {
    expect(recordFromItems([], item => item)).toEqual({});
  });

  it('builds a record keyed by the result of getKey', () => {
    const items = [
      { id: 'a', value: 1 },
      { id: 'b', value: 2 }
    ];
    expect(recordFromItems(items, item => item.id)).toEqual({
      a: { id: 'a', value: 1 },
      b: { id: 'b', value: 2 }
    });
  });

  it('last item wins when multiple items share the same key', () => {
    const items = [
      { id: 'x', n: 1 },
      { id: 'x', n: 2 }
    ];
    expect(recordFromItems(items, item => item.id)).toEqual({
      x: { id: 'x', n: 2 }
    });
  });
});

describe('mirrorRecord', () => {
  it('swaps keys and values', () => {
    expect(mirrorRecord({ a: 'x', b: 'y' })).toEqual({ x: 'a', y: 'b' });
  });

  it('returns an empty record for an empty input', () => {
    expect(mirrorRecord({})).toEqual({});
  });

  it('handles numeric values becoming keys', () => {
    expect(mirrorRecord({ one: 1, two: 2 })).toEqual({ 1: 'one', 2: 'two' });
  });
});

describe('areEqualRecords', () => {
  it('returns true for two empty records', () => {
    expect(areEqualRecords({}, {})).toBe(true);
  });

  it('returns true for records with the same keys and values', () => {
    expect(areEqualRecords({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
  });

  it('returns false when values differ', () => {
    expect(areEqualRecords({ a: 1 }, { a: 2 })).toBe(false);
  });

  it('returns false when key counts differ', () => {
    expect(areEqualRecords({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('uses reference equality for object values', () => {
    const obj = { n: 1 };
    expect(areEqualRecords({ a: obj }, { a: obj })).toBe(true);
    expect(areEqualRecords({ a: { n: 1 } }, { a: { n: 1 } })).toBe(false);
  });
});

describe('haveEqualFields', () => {
  it('returns true when all specified fields are equal', () => {
    expect(
      haveEqualFields(['a', 'b'], { a: 1, b: 2, c: 3 }, { a: 1, b: 2, c: 99 })
    ).toBe(true);
  });

  it('returns false when any specified field differs', () => {
    expect(haveEqualFields(['a', 'b'], { a: 1, b: 2 }, { a: 1, b: 99 })).toBe(
      false
    );
  });

  it('returns true for an empty fields list', () => {
    expect(haveEqualFields([], { a: 1 }, { a: 99 })).toBe(true);
  });
});

describe('withoutUndefinedFields', () => {
  it('returns an empty record for an empty input', () => {
    expect(withoutUndefinedFields({})).toEqual({});
  });

  it('removes keys whose value is undefined', () => {
    expect(withoutUndefinedFields({ a: 1, b: undefined, c: 'hello' })).toEqual({
      a: 1,
      c: 'hello'
    });
  });

  it('keeps keys with null values', () => {
    expect(withoutUndefinedFields({ a: null, b: undefined })).toEqual({
      a: null
    });
  });

  it('keeps keys with falsy non-undefined values', () => {
    expect(withoutUndefinedFields({ a: 0, b: '', c: false })).toEqual({
      a: 0,
      b: '',
      c: false
    });
  });
});

describe('toEntries', () => {
  it('returns an empty array for an empty record', () => {
    expect(toEntries({})).toEqual([]);
  });

  it('converts a record to an array of key-value entries', () => {
    const entries = toEntries({ a: 1, b: 2 });
    expect(entries).toHaveLength(2);
    expect(entries).toContainEqual({ key: 'a', value: 1 });
    expect(entries).toContainEqual({ key: 'b', value: 2 });
  });

  it('preserves value types', () => {
    const entries = toEntries({ x: 'hello' });
    expect(entries[0]).toEqual({ key: 'x', value: 'hello' });
  });
});
