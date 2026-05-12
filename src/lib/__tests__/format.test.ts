import {
  depositAddressWrapTailLength,
  formatWalletAddress,
  formatAmount,
  splitAddressForDepositWrap
} from '@/lib/format';

describe('formatWalletAddress', () => {
  it('truncates a long address with ellipsis using default chars', () => {
    const address = '0x1234567890abcdef1234';
    const result = formatWalletAddress({ address });
    expect(result).toBe('0x1234...1234');
  });

  it('truncates with custom startChars and endChars', () => {
    const address = '0xabcdef1234567890';
    const result = formatWalletAddress({ address, startChars: 4, endChars: 6 });
    expect(result).toBe('0xab...567890');
  });

  it('returns the address as-is when it is shorter than startChars + endChars', () => {
    const shortAddress = '0x1234';
    const result = formatWalletAddress({
      address: shortAddress,
      startChars: 6,
      endChars: 4
    });
    expect(result).toBe(shortAddress);
  });

  it('returns the address as-is when it is exactly startChars + endChars in length', () => {
    const address = '0x12345678901234';
    const result = formatWalletAddress({
      address,
      startChars: 8,
      endChars: address.length - 8
    });
    expect(result).toBe(address);
  });

  it('uses custom startChars of 10 and default endChars', () => {
    const address = '0xabcdefabcdefabcdef1234';
    const result = formatWalletAddress({ address, startChars: 10 });
    expect(result.startsWith(address.slice(0, 10))).toBe(true);
    expect(result.endsWith(address.slice(-4))).toBe(true);
    expect(result).toContain('...');
  });
});

describe('splitAddressForDepositWrap', () => {
  it('splits a long hex address so the tail stays unbreakable', () => {
    const address = `0x${'a'.repeat(40)}`;
    const { head, tail } = splitAddressForDepositWrap({ address });
    expect(head).toHaveLength(42 - depositAddressWrapTailLength);
    expect(tail).toHaveLength(depositAddressWrapTailLength);
    expect(`${head}${tail}`).toBe(address);
  });

  it('returns the full string as head when shorter than tail length', () => {
    expect(splitAddressForDepositWrap({ address: '0x1234' })).toEqual({
      head: '0x1234',
      tail: ''
    });
  });

  it('respects a custom tail length', () => {
    const address = '0xabcdef';
    expect(splitAddressForDepositWrap({ address, tailLength: 3 })).toEqual({
      head: '0xabc',
      tail: 'def'
    });
  });
});

describe('formatAmount', () => {
  it('returns "0" for a value of zero', () => {
    expect(formatAmount({ value: 0 })).toBe('0');
  });

  it('formats a whole integer', () => {
    expect(formatAmount({ value: 42 })).toBe('42');
  });

  it('formats a large number with grouping separators', () => {
    const result = formatAmount({ value: 1_234_567 });
    expect(result).toBe('1,234,567');
  });

  it('limits decimals to maxDecimals for values >= 1', () => {
    const result = formatAmount({ value: 3.14159, maxDecimals: 6 });
    expect(result).toBe('3.14');
  });

  it('respects maxDecimals when it is less than 2', () => {
    const result = formatAmount({ value: 3.14159, maxDecimals: 1 });
    expect(result).toBe('3.1');
  });

  it('formats a small decimal below 1 with more significant digits', () => {
    const result = formatAmount({ value: 0.000123, maxDecimals: 6 });
    expect(result).toMatch(/^0\.0001[0-9]+/);
  });

  it('respects minDecimals by padding with trailing zeros', () => {
    const result = formatAmount({ value: 5, minDecimals: 2 });
    expect(result).toBe('5.00');
  });

  it('handles negative values', () => {
    const result = formatAmount({ value: -1500.5 });
    expect(result).toBe('-1,500.5');
  });

  it('does not exceed maxDecimals', () => {
    const result = formatAmount({ value: 1.23456789, maxDecimals: 4 });
    const decimals = result.split('.')[1];
    expect(decimals === undefined || decimals.length <= 4).toBe(true);
  });
});
