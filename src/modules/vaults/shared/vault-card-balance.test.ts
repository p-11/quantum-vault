import { describe, expect, it } from 'vitest';
import type { WithdrawalRecord } from '@project-eleven/libqc';

import { deriveVaultLifecycleStatus } from '../lifecycle/adapter';
import type { VaultSnapshot } from '../types';
import {
  getVaultCardBalanceDisplay,
  type VaultCardBalanceDisplay
} from './vault-card-balance';

const safeSnapshot: VaultSnapshot = {
  status: 'safe',
  tokenCount: 1,
  totalBalance: 15.04,
  isUnavailable: false
};

const unavailableSnapshot: VaultSnapshot = {
  status: null,
  tokenCount: null,
  totalBalance: null,
  isUnavailable: true
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

describe('getVaultCardBalanceDisplay', () => {
  it('returns the live snapshot value for safe vaults', () => {
    const result = getVaultCardBalanceDisplay({
      snapshot: safeSnapshot,
      lifecycleKind: 'safe'
    });

    expect(result).toEqual<VaultCardBalanceDisplay>({
      kind: 'value',
      totalBalance: 15.04,
      tokenCount: 1
    });
  });

  it('returns the live snapshot value for vulnerable vaults', () => {
    const result = getVaultCardBalanceDisplay({
      snapshot: safeSnapshot,
      lifecycleKind: 'vulnerable'
    });

    expect(result).toEqual<VaultCardBalanceDisplay>({
      kind: 'value',
      totalBalance: 15.04,
      tokenCount: 1
    });
  });

  it.each(['pending', 'sent', 'withdrawn'] as const)(
    'collapses the displayed totals to zero for %s lifecycle vaults',
    lifecycleKind => {
      // Snapshot still reports the pre-withdrawal balance (pending tx case);
      // the display must not surface it under the Withdrawn home section.
      const result = getVaultCardBalanceDisplay({
        snapshot: safeSnapshot,
        lifecycleKind
      });

      expect(result).toEqual<VaultCardBalanceDisplay>({
        kind: 'value',
        totalBalance: 0,
        tokenCount: 0
      });
    }
  );

  it('returns the unavailable variant when the snapshot fetch failed', () => {
    const result = getVaultCardBalanceDisplay({
      snapshot: unavailableSnapshot,
      lifecycleKind: 'safe'
    });

    expect(result).toEqual<VaultCardBalanceDisplay>({ kind: 'unavailable' });
  });

  it('keeps the unavailable variant even when the lifecycle is in withdrawal', () => {
    // An unavailable snapshot means we have no signal at all - we must not
    // pretend the vault is at zero just because the lifecycle flag flipped.
    const result = getVaultCardBalanceDisplay({
      snapshot: unavailableSnapshot,
      lifecycleKind: 'pending'
    });

    expect(result).toEqual<VaultCardBalanceDisplay>({ kind: 'unavailable' });
  });

  it('throws when snapshot total balance is missing for a non-withdrawal lifecycle', () => {
    const snapshot: VaultSnapshot = {
      status: 'safe',
      tokenCount: 1,
      totalBalance: null,
      isUnavailable: false
    };

    expect(() =>
      getVaultCardBalanceDisplay({
        snapshot,
        lifecycleKind: 'safe'
      })
    ).toThrow('vault snapshot total balance');
  });

  it('throws when snapshot token count is missing for a non-withdrawal lifecycle', () => {
    const snapshot: VaultSnapshot = {
      status: 'safe',
      tokenCount: null,
      totalBalance: 1,
      isUnavailable: false
    };

    expect(() =>
      getVaultCardBalanceDisplay({
        snapshot,
        lifecycleKind: 'safe'
      })
    ).toThrow('vault snapshot token count');
  });

  it('restores the live snapshot value after lifecycle resolution sees a failed withdrawal', () => {
    const accountId = 'safe-account';
    const failedLifecycleStatus = deriveVaultLifecycleStatus({
      snapshot: safeSnapshot,
      withdrawalRecord: createWithdrawalRecord({
        accountId,
        status: 'failed'
      })
    });
    const pending = getVaultCardBalanceDisplay({
      snapshot: safeSnapshot,
      lifecycleKind: deriveVaultLifecycleStatus({
        snapshot: safeSnapshot,
        withdrawalRecord: createWithdrawalRecord({
          accountId,
          status: 'pending'
        })
      }).kind
    });
    expect(pending).toEqual<VaultCardBalanceDisplay>({
      kind: 'value',
      totalBalance: 0,
      tokenCount: 0
    });

    const reverted = getVaultCardBalanceDisplay({
      snapshot: safeSnapshot,
      lifecycleKind: failedLifecycleStatus.kind
    });
    expect(failedLifecycleStatus.kind).toBe('safe');
    expect(reverted).toEqual<VaultCardBalanceDisplay>({
      kind: 'value',
      totalBalance: 15.04,
      tokenCount: 1
    });
  });
});
