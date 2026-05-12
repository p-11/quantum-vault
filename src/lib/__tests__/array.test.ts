import {
  getLastItem,
  getPairComplement,
  groupItems,
  haveSameContent,
  isEmpty,
  order,
  range,
  splitBy,
  sum,
  toBatches,
  toggleInclusion,
  updateAtIndex,
  without,
  withoutDuplicates
} from '@/lib/array';

describe('isEmpty', () => {
  it('returns true for an empty array', () => {
    expect(isEmpty([])).toBe(true);
  });

  it('returns false for a single-element array', () => {
    expect(isEmpty([1])).toBe(false);
  });

  it('returns false for a multi-element array', () => {
    expect(isEmpty([1, 2, 3])).toBe(false);
  });
});

describe('range', () => {
  it('returns an empty array for length 0', () => {
    expect(range(0)).toEqual([]);
  });

  it('returns a single-element array for length 1', () => {
    expect(range(1)).toEqual([0]);
  });

  it('returns indices starting at 0 for length n', () => {
    expect(range(5)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('sum', () => {
  it('returns 0 for an empty array', () => {
    expect(sum([])).toBe(0);
  });

  it('returns the single value for a one-element array', () => {
    expect(sum([7])).toBe(7);
  });

  it('sums positive numbers', () => {
    expect(sum([1, 2, 3, 4])).toBe(10);
  });

  it('sums negative numbers', () => {
    expect(sum([-1, -2, -3])).toBe(-6);
  });

  it('sums mixed positive and negative numbers', () => {
    expect(sum([10, -4, 2])).toBe(8);
  });
});

describe('without', () => {
  it('returns an empty array when given an empty source', () => {
    expect(without([], [1, 2])).toEqual([]);
  });

  it('removes all excluded items', () => {
    expect(without([1, 2, 3, 4], [2, 4])).toEqual([1, 3]);
  });

  it('returns original items when nothing is excluded', () => {
    expect(without([1, 2, 3], [])).toEqual([1, 2, 3]);
  });

  it('does not mutate the source array', () => {
    const source = [1, 2, 3];
    without(source, [1]);
    expect(source).toEqual([1, 2, 3]);
  });
});

describe('withoutDuplicates', () => {
  it('returns an empty array unchanged', () => {
    expect(withoutDuplicates([])).toEqual([]);
  });

  it('removes primitive duplicates without a key function', () => {
    expect(withoutDuplicates([1, 2, 1, 3, 2])).toEqual([1, 2, 3]);
  });

  it('preserves order of first occurrence', () => {
    expect(withoutDuplicates(['b', 'a', 'b', 'c', 'a'])).toEqual([
      'b',
      'a',
      'c'
    ]);
  });

  it('removes object duplicates using a key function', () => {
    const items = [
      { id: 1, name: 'alpha' },
      { id: 2, name: 'beta' },
      { id: 1, name: 'alpha-duplicate' }
    ];
    expect(withoutDuplicates(items, item => item.id)).toEqual([
      { id: 1, name: 'alpha' },
      { id: 2, name: 'beta' }
    ]);
  });

  it('does not mutate the source array', () => {
    const source = [1, 1, 2];
    withoutDuplicates(source);
    expect(source).toEqual([1, 1, 2]);
  });
});

describe('toggleInclusion', () => {
  it('adds an item that is not present', () => {
    expect(toggleInclusion([1, 2], 3)).toEqual([1, 2, 3]);
  });

  it('removes an item that is already present', () => {
    expect(toggleInclusion([1, 2, 3], 2)).toEqual([1, 3]);
  });

  it('adds to an empty array', () => {
    expect(toggleInclusion([], 'a')).toEqual(['a']);
  });

  it('removes the only element leaving an empty array', () => {
    expect(toggleInclusion(['a'], 'a')).toEqual([]);
  });

  it('does not mutate the source array', () => {
    const source = [1, 2, 3];
    toggleInclusion(source, 2);
    expect(source).toEqual([1, 2, 3]);
  });
});

describe('splitBy', () => {
  it('splits into passing and failing buckets', () => {
    const [evens, odds] = splitBy([1, 2, 3, 4, 5], n => n % 2 === 0);
    expect(evens).toEqual([2, 4]);
    expect(odds).toEqual([1, 3, 5]);
  });

  it('returns two empty arrays for an empty input', () => {
    expect(splitBy([], () => true)).toEqual([[], []]);
  });

  it('puts everything in the passing bucket when predicate always returns true', () => {
    const [pass, fail] = splitBy([1, 2, 3], () => true);
    expect(pass).toEqual([1, 2, 3]);
    expect(fail).toEqual([]);
  });

  it('puts everything in the failing bucket when predicate always returns false', () => {
    const [pass, fail] = splitBy([1, 2, 3], () => false);
    expect(pass).toEqual([]);
    expect(fail).toEqual([1, 2, 3]);
  });

  it('passes the index to the predicate', () => {
    const [evenIndex] = splitBy(['a', 'b', 'c', 'd'], (_, i) => i % 2 === 0);
    expect(evenIndex).toEqual(['a', 'c']);
  });
});

describe('toBatches', () => {
  it('throws when batchSize is 0', () => {
    expect(() => toBatches([1, 2, 3], 0)).toThrow();
  });

  it('throws when batchSize is negative', () => {
    expect(() => toBatches([1, 2, 3], -1)).toThrow();
  });

  it('returns an empty array for an empty input', () => {
    expect(toBatches([], 2)).toEqual([]);
  });

  it('groups items into full batches', () => {
    expect(toBatches([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4]
    ]);
  });

  it('puts remainder items in the last batch', () => {
    expect(toBatches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns a single batch when batchSize exceeds array length', () => {
    expect(toBatches([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });
});

describe('groupItems', () => {
  it('returns an empty record for an empty array', () => {
    expect(groupItems([], item => item)).toEqual({});
  });

  it('groups items by the returned key', () => {
    const items = [
      { type: 'fruit', name: 'apple' },
      { type: 'veggie', name: 'carrot' },
      { type: 'fruit', name: 'banana' }
    ];
    const grouped = groupItems(items, item => item.type);
    expect(grouped['fruit']).toEqual([
      { type: 'fruit', name: 'apple' },
      { type: 'fruit', name: 'banana' }
    ]);
    expect(grouped['veggie']).toEqual([{ type: 'veggie', name: 'carrot' }]);
  });

  it('creates a single-key record when all items share the same key', () => {
    const grouped = groupItems([1, 2, 3], () => 'all');
    expect(grouped['all']).toEqual([1, 2, 3]);
  });
});

describe('order', () => {
  it('sorts numbers ascending by default', () => {
    expect(order([3, 1, 2], n => n)).toEqual([1, 2, 3]);
  });

  it('sorts numbers descending when direction is desc', () => {
    expect(order([3, 1, 2], n => n, 'desc')).toEqual([3, 2, 1]);
  });

  it('sorts objects by a derived numeric value', () => {
    const items = [{ v: 5 }, { v: 1 }, { v: 3 }];
    expect(order(items, item => item.v)).toEqual([
      { v: 1 },
      { v: 3 },
      { v: 5 }
    ]);
  });

  it('does not mutate the source array', () => {
    const source = [3, 1, 2];
    order(source, n => n);
    expect(source).toEqual([3, 1, 2]);
  });

  it('returns an empty array unchanged', () => {
    expect(order([], n => n)).toEqual([]);
  });
});

describe('getLastItem', () => {
  it('returns undefined for an empty array', () => {
    expect(getLastItem([])).toBeUndefined();
  });

  it('returns the single element for a one-element array', () => {
    expect(getLastItem([42])).toBe(42);
  });

  it('returns the last element of a multi-element array', () => {
    expect(getLastItem([1, 2, 3])).toBe(3);
  });
});

describe('haveSameContent', () => {
  it('returns true for two empty arrays', () => {
    expect(haveSameContent([], [])).toBe(true);
  });

  it('returns true for equal arrays', () => {
    expect(haveSameContent([1, 2, 3], [1, 2, 3])).toBe(true);
  });

  it('returns false when lengths differ', () => {
    expect(haveSameContent([1, 2], [1, 2, 3])).toBe(false);
  });

  it('returns false when same elements are in different order', () => {
    expect(haveSameContent([1, 2, 3], [3, 2, 1])).toBe(false);
  });

  it('returns false when elements differ', () => {
    expect(haveSameContent([1, 2, 3], [1, 2, 4])).toBe(false);
  });
});

describe('getPairComplement', () => {
  it('returns the second element when given the first', () => {
    expect(getPairComplement(['a', 'b'], 'a')).toBe('b');
  });

  it('returns the first element when given the second', () => {
    expect(getPairComplement(['a', 'b'], 'b')).toBe('a');
  });

  it('returns the second element when the item does not match the first', () => {
    expect(getPairComplement([1, 2], 99)).toBe(1);
  });

  it('works with numeric pairs', () => {
    expect(getPairComplement([10, 20], 10)).toBe(20);
  });
});

describe('updateAtIndex', () => {
  it('applies the update function only at the specified index', () => {
    expect(updateAtIndex([1, 2, 3], 1, n => n * 10)).toEqual([1, 20, 3]);
  });

  it('applies the update at index 0', () => {
    expect(updateAtIndex(['a', 'b', 'c'], 0, s => s.toUpperCase())).toEqual([
      'A',
      'b',
      'c'
    ]);
  });

  it('applies the update at the last index', () => {
    expect(updateAtIndex([1, 2, 3], 2, n => n + 100)).toEqual([1, 2, 103]);
  });

  it('does not mutate the source array', () => {
    const source = [1, 2, 3];
    updateAtIndex(source, 0, n => n + 1);
    expect(source).toEqual([1, 2, 3]);
  });

  it('returns the array unchanged when index is out of bounds', () => {
    expect(updateAtIndex([1, 2, 3], 10, n => n + 1)).toEqual([1, 2, 3]);
  });
});
