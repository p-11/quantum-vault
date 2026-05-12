import { describe, expect, it } from 'vitest';
import type { WithdrawalRecord } from '@project-eleven/libqc';

import { deriveVaultLifecycleStatus } from '../lifecycle/adapter';
import { getVaultDetailDisplayedTotalCurrencyValue } from './balance-display';
import type { VaultData } from './types';

const safeVaultData: VaultData = {
  assets: [],
  balances: [],
  activities: [],
  hasNonInterfaceAssetBalance: false,
  onChainVaultStatus: 'safe',
  totalCurrencyValue: 20.03
};

const createWithdrawalRecord = ({
  accountId,
  status
}: Pick<WithdrawalRecord, 'accountId' | 'status'>): WithdrawalRecord => ({
  id: `${accountId}-${status}`,
  accountId,
  destinationAddress: '0x1111111111111111111111111111111111111111',
  destinationChain: 'eip155:1',
  initiatedAt: 1_710_000_000_000,
  sentAt: null,
  completedAt: null,
  failedAt: status === 'failed' ? 1_710_000_001_000 : null,
  status,
  txRefs: []
});

describe('getVaultDetailDisplayedTotalCurrencyValue', () => {
  it('returns undefined while vaultData is still loading', () => {
    expect(
      getVaultDetailDisplayedTotalCurrencyValue({
        vaultData: undefined,
        lifecycleKind: 'safe'
      })
    ).toBeUndefined();
  });

  it('returns the live total for non-withdrawal lifecycles', () => {
    expect(
      getVaultDetailDisplayedTotalCurrencyValue({
        vaultData: safeVaultData,
        lifecycleKind: 'safe'
      })
    ).toBe(20.03);
    expect(
      getVaultDetailDisplayedTotalCurrencyValue({
        vaultData: safeVaultData,
        lifecycleKind: 'vulnerable'
      })
    ).toBe(20.03);
  });

  it.each(['pending', 'sent', 'withdrawn'] as const)(
    'collapses the displayed total to zero for the %s lifecycle',
    lifecycleKind => {
      expect(
        getVaultDetailDisplayedTotalCurrencyValue({
          vaultData: safeVaultData,
          lifecycleKind
        })
      ).toBe(0);
    }
  );

  it('restores the live total after lifecycle resolution sees a failed withdrawal', () => {
    const accountId = 'safe-account';
    const snapshot = {
      isUnavailable: false,
      status: safeVaultData.onChainVaultStatus,
      tokenCount: safeVaultData.balances.length,
      totalBalance: safeVaultData.totalCurrencyValue
    };
    const failedLifecycleStatus = deriveVaultLifecycleStatus({
      snapshot,
      withdrawalRecord: createWithdrawalRecord({
        accountId,
        status: 'failed'
      })
    });
    const pending = getVaultDetailDisplayedTotalCurrencyValue({
      vaultData: safeVaultData,
      lifecycleKind: deriveVaultLifecycleStatus({
        snapshot,
        withdrawalRecord: createWithdrawalRecord({
          accountId,
          status: 'pending'
        })
      }).kind
    });
    const reverted = getVaultDetailDisplayedTotalCurrencyValue({
      vaultData: safeVaultData,
      lifecycleKind: failedLifecycleStatus.kind
    });

    expect(failedLifecycleStatus.kind).toBe('safe');
    expect(pending).toBe(0);
    expect(reverted).toBe(20.03);
  });
});
