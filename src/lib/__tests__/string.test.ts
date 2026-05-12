import {
  areLowerCaseEqual,
  capitalizeFirstLetter,
  normalizeNonEmptyString,
  truncate
} from '@/lib/string';

describe('capitalizeFirstLetter', () => {
  it('capitalizes the first letter of a lowercase word', () => {
    expect(capitalizeFirstLetter('hello')).toBe('Hello');
  });

  it('leaves an already capitalized word unchanged', () => {
    expect(capitalizeFirstLetter('World')).toBe('World');
  });

  it('handles a single lowercase character', () => {
    expect(capitalizeFirstLetter('a')).toBe('A');
  });

  it('handles an empty string', () => {
    expect(capitalizeFirstLetter('')).toBe('');
  });

  it('does not alter characters beyond the first', () => {
    expect(capitalizeFirstLetter('hELLO')).toBe('HELLO');
  });

  it('handles a string that starts with a number', () => {
    expect(capitalizeFirstLetter('1st')).toBe('1st');
  });
});

describe('areLowerCaseEqual', () => {
  it('returns true for identical strings', () => {
    expect(areLowerCaseEqual('hello', 'hello')).toBe(true);
  });

  it('returns true when strings differ only in case', () => {
    expect(areLowerCaseEqual('Hello', 'hello')).toBe(true);
  });

  it('returns true for fully uppercase vs lowercase', () => {
    expect(areLowerCaseEqual('WORLD', 'world')).toBe(true);
  });

  it('returns false for strings with different content', () => {
    expect(areLowerCaseEqual('hello', 'world')).toBe(false);
  });

  it('returns true for two empty strings', () => {
    expect(areLowerCaseEqual('', '')).toBe(true);
  });

  it('returns false for empty string vs non-empty string', () => {
    expect(areLowerCaseEqual('', 'a')).toBe(false);
  });
});

describe('normalizeNonEmptyString', () => {
  it('returns undefined for an empty string', () => {
    expect(normalizeNonEmptyString('')).toBeUndefined();
  });

  it('returns undefined for a whitespace-only string', () => {
    expect(normalizeNonEmptyString('   ')).toBeUndefined();
  });

  it('returns undefined for a tab-only string', () => {
    expect(normalizeNonEmptyString('\t\n')).toBeUndefined();
  });

  it('returns the trimmed string for a value with surrounding whitespace', () => {
    expect(normalizeNonEmptyString('  hello  ')).toBe('hello');
  });

  it('returns the string unchanged when there is no surrounding whitespace', () => {
    expect(normalizeNonEmptyString('hello')).toBe('hello');
  });

  it('returns a single character string', () => {
    expect(normalizeNonEmptyString('a')).toBe('a');
  });
});

describe('truncate', () => {
  it('returns the text unchanged when shorter than maxLength', () => {
    expect(truncate({ text: 'hi', maxLength: 10 })).toBe('hi');
  });

  it('returns the text unchanged when equal to maxLength', () => {
    expect(truncate({ text: 'hello', maxLength: 5 })).toBe('hello');
  });

  it('truncates and appends the default suffix when text exceeds maxLength', () => {
    expect(truncate({ text: 'hello world', maxLength: 8 })).toBe('hello...');
  });

  it('uses a custom suffix when provided', () => {
    expect(truncate({ text: 'hello world', maxLength: 7, suffix: '…' })).toBe(
      'hello …'
    );
  });

  it('truncates to exactly maxLength characters including the suffix', () => {
    const result = truncate({ text: 'abcdefghij', maxLength: 6 });
    expect(result.length).toBe(6);
    expect(result).toBe('abc...');
  });

  it('handles an empty string', () => {
    expect(truncate({ text: '', maxLength: 5 })).toBe('');
  });

  it('works with a suffix longer than maxLength by producing an empty prefix', () => {
    expect(truncate({ text: 'abcdef', maxLength: 3, suffix: '...' })).toBe(
      '...'
    );
  });
});
