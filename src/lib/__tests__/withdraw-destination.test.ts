import { describe, expect, it, vi } from 'vitest';

// libqc's ESM entry cannot be loaded under vitest; only `isAddress` is
// needed here and its EVM semantics are not under test, so a shape check
// stands in for viem's implementation.
vi.mock('@project-eleven/libqc', () => ({
  isAddress: (value: string) => /^0x[0-9a-fA-F]{40}$/.test(value)
}));

import { withdrawFlowCopy } from '@/lib/copy';
import { getAddressValidationError } from '@/lib/withdraw-destination';

const bitcoinNamespace = 'bip122';
const evmNamespace = 'eip155';

describe('getAddressValidationError', () => {
  it.each([
    ['legacy P2PKH', '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2'],
    ['P2SH', '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy'],
    ['bech32 P2WPKH', 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'],
    [
      'bech32m P2TR',
      'bc1pw508d6qejxtdg4y5r3zarvary0c5xw7kw508d6qejxtdg4y5r3zarvary0c5xw7kt5nd6y'
    ],
    ['uppercase bech32', 'BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4']
  ])('accepts a %s Bitcoin mainnet address', (_label, destination) => {
    expect(
      getAddressValidationError({ destination, namespace: bitcoinNamespace })
    ).toBeNull();
  });

  it.each([
    ['an EVM address', '0x8ba1f109551bD432803012645Ac136ddd64DBA72'],
    ['a testnet bech32 address', 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'],
    ['a bech32 address with invalid charset', 'bc1qwithdrawndestination0000'],
    ['a truncated bech32 address', 'bc1q'],
    ['mixed-case bech32', 'bc1Qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'],
    ['an empty string', '']
  ])('rejects %s for a Bitcoin vault', (_label, destination) => {
    expect(
      getAddressValidationError({ destination, namespace: bitcoinNamespace })
    ).toBe(withdrawFlowCopy.invalidBitcoinAddressError);
  });

  it('accepts a checksummed EVM address', () => {
    expect(
      getAddressValidationError({
        destination: '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
        namespace: evmNamespace
      })
    ).toBeNull();
  });

  it('rejects a Bitcoin address for an EVM vault', () => {
    expect(
      getAddressValidationError({
        destination: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        namespace: evmNamespace
      })
    ).toBe(withdrawFlowCopy.invalidEvmAddressError);
  });

  it('throws for an unsupported namespace', () => {
    expect(() =>
      getAddressValidationError({ destination: 'x', namespace: 'solana' })
    ).toThrow('Unsupported withdraw namespace: solana');
  });
});
