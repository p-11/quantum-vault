import { describe, expect, it, vi } from 'vitest';
import type { VaultLifecycleKind } from '../../lifecycle/core';
import type { VaultLifecycleAccount } from '../../lifecycle/account-read-model';
import type { VaultSnapshot } from '../../types';
import {
  buildAccountChainByReference,
  getTotalBalanceFromAccountSnapshots,
  getVaultNumberByAccountId
} from './vault';

vi.mock('@project-eleven/libqc', () => ({}));

const createAccount = ({
  id,
  chainReference
}: {
  id: string;
  chainReference: string;
}) => ({
  id: {
    toString: () => id
  },
  address: `0x${id}`,
  chainId: {
    reference: chainReference,
    toString: () => `eip155:${chainReference}`
  }
});

const createSnapshot = (
  overrides: Partial<VaultSnapshot> = {}
): VaultSnapshot => ({
  isUnavailable: false,
  status: 'safe',
  tokenCount: 0,
  totalBalance: 0,
  ...overrides
});

describe('vault mappers', () => {
  it('builds chain metadata lookup keyed by chain reference', () => {
    const accountChainByReference = buildAccountChainByReference([
      {
        chainId: { reference: '1' },
        iconUrl: 'eth-icon',
        name: 'Ethereum',
        nativeCurrency: { symbol: 'ETH' }
      },
      {
        chainId: { reference: 'bitcoin-mainnet' },
        iconUrl: 'btc-icon',
        name: 'Bitcoin',
        nativeCurrency: { symbol: 'BTC' }
      }
    ]);

    expect(accountChainByReference).toEqual({
      '1': {
        iconUrl: 'eth-icon',
        name: 'Ethereum',
        symbol: 'ETH'
      },
      'bitcoin-mainnet': {
        iconUrl: 'btc-icon',
        name: 'Bitcoin',
        symbol: 'BTC'
      }
    });
  });

  it('assigns vault numbers per chain in account order', () => {
    const accounts = [
      createAccount({ id: 'eth-a', chainReference: '1' }),
      createAccount({ id: 'eth-b', chainReference: '1' }),
      createAccount({ id: 'btc-a', chainReference: 'bitcoin-mainnet' }),
      createAccount({ id: 'eth-c', chainReference: '1' })
    ] satisfies Parameters<typeof getVaultNumberByAccountId>[0];

    expect(getVaultNumberByAccountId(accounts)).toEqual({
      'eth-a': 1,
      'eth-b': 2,
      'btc-a': 1,
      'eth-c': 3
    });
  });

  describe('getTotalBalanceFromAccountSnapshots', () => {
    const createLifecycleAccount = ({
      accountId,
      lifecycleKind,
      snapshot
    }: {
      accountId: string;
      lifecycleKind: VaultLifecycleKind;
      snapshot: VaultSnapshot;
    }): Pick<
      VaultLifecycleAccount,
      'accountId' | 'lifecycleKind' | 'snapshot'
    > => ({
      accountId,
      lifecycleKind,
      snapshot
    });

    it('sums available snapshot balances for non-withdrawal lifecycles', () => {
      const totalBalance = getTotalBalanceFromAccountSnapshots({
        lifecycleAccounts: [
          createLifecycleAccount({
            accountId: 'safe-account',
            lifecycleKind: 'safe',
            snapshot: createSnapshot({ totalBalance: 12.5 })
          }),
          createLifecycleAccount({
            accountId: 'vulnerable-account',
            lifecycleKind: 'vulnerable',
            snapshot: createSnapshot({ totalBalance: 7.25 })
          }),
          createLifecycleAccount({
            accountId: 'pending-account',
            lifecycleKind: 'pending',
            snapshot: createSnapshot({ totalBalance: 15.04 })
          }),
          createLifecycleAccount({
            accountId: 'sent-account',
            lifecycleKind: 'sent',
            snapshot: createSnapshot({ totalBalance: 3 })
          }),
          createLifecycleAccount({
            accountId: 'withdrawn-account',
            lifecycleKind: 'withdrawn',
            snapshot: createSnapshot({ totalBalance: 2 })
          })
        ]
      });

      expect(totalBalance).toEqual({ kind: 'value', value: 12.5 + 7.25 });
    });

    it('collapses every withdrawal-lifecycle account to zero', () => {
      const totalBalance = getTotalBalanceFromAccountSnapshots({
        lifecycleAccounts: [
          createLifecycleAccount({
            accountId: 'pending-account',
            lifecycleKind: 'pending',
            snapshot: createSnapshot({ totalBalance: 15.04 })
          }),
          createLifecycleAccount({
            accountId: 'sent-account',
            lifecycleKind: 'sent',
            snapshot: createSnapshot({ totalBalance: 7.5 })
          }),
          createLifecycleAccount({
            accountId: 'withdrawn-account',
            lifecycleKind: 'withdrawn',
            snapshot: createSnapshot({ totalBalance: 2.25 })
          })
        ]
      });

      expect(totalBalance).toEqual({ kind: 'value', value: 0 });
    });

    it('returns zero when nothing is loaded yet', () => {
      const totalBalance = getTotalBalanceFromAccountSnapshots({
        lifecycleAccounts: []
      });

      expect(totalBalance).toEqual({ kind: 'value', value: 0 });
    });

    it('returns unavailable when non-withdrawal balance data is unavailable', () => {
      const totalBalance = getTotalBalanceFromAccountSnapshots({
        lifecycleAccounts: [
          createLifecycleAccount({
            accountId: 'safe-account',
            lifecycleKind: 'safe',
            snapshot: createSnapshot({ totalBalance: 12.5 })
          }),
          createLifecycleAccount({
            accountId: 'unavailable-account',
            lifecycleKind: 'vulnerable',
            snapshot: createSnapshot({
              isUnavailable: true,
              totalBalance: null
            })
          })
        ]
      });

      expect(totalBalance).toEqual({ kind: 'unavailable' });
    });

    it('ignores unavailable withdrawal-lifecycle balance data', () => {
      const totalBalance = getTotalBalanceFromAccountSnapshots({
        lifecycleAccounts: [
          createLifecycleAccount({
            accountId: 'withdrawn-account',
            lifecycleKind: 'withdrawn',
            snapshot: createSnapshot({
              isUnavailable: true,
              totalBalance: null
            })
          })
        ]
      });

      expect(totalBalance).toEqual({ kind: 'value', value: 0 });
    });
  });
});
