import { describe, expect, it, vi } from 'vitest';

import {
  invalidateVaultAccountQueriesForSession,
  resolvePostWithdrawAccountIdsToInvalidate,
  resolveOwnedDestinationAccountId,
  resolveOwnedWithdrawalDestinationAccountId
} from './wallet-query-invalidation';

const createAccount = ({
  id,
  chainNamespace,
  chainId,
  address
}: {
  id: string;
  chainNamespace: string;
  chainId: string;
  address: string;
}) => ({
  id: { toString: () => id },
  chainId: {
    namespace: chainNamespace,
    toString: () => chainId
  },
  address
});

describe('resolveOwnedDestinationAccountId', () => {
  it('returns the same-chain owned destination account id', () => {
    const sourceAccount = createAccount({
      id: 'source',
      chainNamespace: 'eip155',
      chainId: 'eip155:1',
      address: '0x1111111111111111111111111111111111111111'
    });
    const destinationAccount = createAccount({
      id: 'destination',
      chainNamespace: 'eip155',
      chainId: 'eip155:1',
      address: '0x2222222222222222222222222222222222222222'
    });

    expect(
      resolveOwnedDestinationAccountId({
        accounts: [
          sourceAccount,
          destinationAccount,
          createAccount({
            id: 'other-chain',
            chainNamespace: 'eip155',
            chainId: 'eip155:8453',
            address: destinationAccount.address
          })
        ],
        destinationAddress: '0x2222222222222222222222222222222222222222',
        sourceAccount
      })
    ).toBe('destination');
  });

  it('matches EVM destination addresses case-insensitively', () => {
    const sourceAccount = createAccount({
      id: 'source',
      chainNamespace: 'eip155',
      chainId: 'eip155:1',
      address: '0x1111111111111111111111111111111111111111'
    });
    const destinationAccount = createAccount({
      id: 'destination',
      chainNamespace: 'eip155',
      chainId: 'eip155:1',
      address: '0xabcdef1234567890abcdef1234567890abcdef12'
    });

    expect(
      resolveOwnedDestinationAccountId({
        accounts: [sourceAccount, destinationAccount],
        destinationAddress: '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12',
        sourceAccount
      })
    ).toBe('destination');
  });

  it('does not match non-EVM destination addresses with different casing', () => {
    const sourceAccount = createAccount({
      id: 'source',
      chainNamespace: 'bip122',
      chainId: 'bip122:000000000019d6689c085ae165831e93',
      address: 'bc1qsource'
    });
    const destinationAccount = createAccount({
      id: 'destination',
      chainNamespace: 'bip122',
      chainId: 'bip122:000000000019d6689c085ae165831e93',
      address: 'BitcoinAddressMixedCase'
    });

    expect(
      resolveOwnedDestinationAccountId({
        accounts: [sourceAccount, destinationAccount],
        destinationAddress: 'bitcoinaddressmixedcase',
        sourceAccount
      })
    ).toBeUndefined();
  });

  it('matches Bitcoin bech32 destination addresses case-insensitively', () => {
    const sourceAccount = createAccount({
      id: 'source',
      chainNamespace: 'bip122',
      chainId: 'bip122:000000000019d6689c085ae165831e93',
      address: 'bc1qsource'
    });
    const destinationAccount = createAccount({
      id: 'destination',
      chainNamespace: 'bip122',
      chainId: 'bip122:000000000019d6689c085ae165831e93',
      address: 'bc1qdestination'
    });

    expect(
      resolveOwnedDestinationAccountId({
        accounts: [sourceAccount, destinationAccount],
        destinationAddress: 'BC1QDESTINATION',
        sourceAccount
      })
    ).toBe('destination');
  });

  it('does not return the source account as its own destination', () => {
    const sourceAccount = createAccount({
      id: 'source',
      chainNamespace: 'eip155',
      chainId: 'eip155:1',
      address: '0x1111111111111111111111111111111111111111'
    });

    expect(
      resolveOwnedDestinationAccountId({
        accounts: [sourceAccount],
        destinationAddress: sourceAccount.address,
        sourceAccount
      })
    ).toBeUndefined();
  });
});

describe('resolveOwnedWithdrawalDestinationAccountId', () => {
  it('resolves an owned destination account from a withdrawal record', () => {
    const sourceAccount = createAccount({
      id: 'source',
      chainNamespace: 'eip155',
      chainId: 'eip155:1',
      address: '0x1111111111111111111111111111111111111111'
    });
    const destinationAccount = createAccount({
      id: 'destination',
      chainNamespace: 'eip155',
      chainId: 'eip155:1',
      address: '0x2222222222222222222222222222222222222222'
    });

    expect(
      resolveOwnedWithdrawalDestinationAccountId({
        accounts: [sourceAccount, destinationAccount],
        sourceAccount,
        withdrawalRecord: {
          destinationAddress: destinationAccount.address
        }
      })
    ).toBe('destination');
  });
});

describe('resolvePostWithdrawAccountIdsToInvalidate', () => {
  it('includes source, replacement, and owned destination accounts once', () => {
    expect(
      resolvePostWithdrawAccountIdsToInvalidate({
        sourceAccountId: 'source',
        replacementAccountId: 'replacement',
        ownedDestinationAccountId: 'destination'
      })
    ).toEqual(['source', 'replacement', 'destination']);
    expect(
      resolvePostWithdrawAccountIdsToInvalidate({
        sourceAccountId: 'source',
        replacementAccountId: 'source',
        ownedDestinationAccountId: 'destination'
      })
    ).toEqual(['source', 'destination']);
  });
});

describe('invalidateVaultAccountQueriesForSession', () => {
  it('invalidates only account-scoped data, activity, and detail queries', async () => {
    const invalidatedQueryKeys: Array<readonly unknown[]> = [];
    const queryClient = {
      invalidateQueries: vi.fn(
        async ({ queryKey }: { queryKey: readonly unknown[] }) => {
          invalidatedQueryKeys.push(queryKey);
        }
      )
    };

    await invalidateVaultAccountQueriesForSession({
      queryClient,
      requestedCurrency: 'usd',
      requestedSessionId: 7,
      accountIds: ['destination-account']
    });

    expect(invalidatedQueryKeys).toEqual([
      ['quantum-vault', 'account-data', 7, 'destination-account', 'usd'],
      ['quantum-vault', 'account-activities', 7, 'destination-account'],
      ['quantum-vault', 'vault-detail', 7, 'destination-account', 'usd']
    ]);
  });
});
