import type {
  BitcoinTransactionId,
  WithdrawalRecord
} from '@project-eleven/libqc';
import {
  deriveVaultLifecycleStatus,
  getLatestWithdrawalRecord,
  getWithdrawalTxRefs
} from './adapter';

const withdrawalRecord: WithdrawalRecord = {
  id: 'record-1',
  accountId: 'account-1',
  destinationAddress: '0x1111111111111111111111111111111111111111',
  destinationChain: 'eip155:1',
  initiatedAt: 1_710_000_000_000,
  sentAt: null,
  completedAt: null,
  failedAt: null,
  status: 'pending',
  txRefs: []
};

const toBitcoinTransactionId = (value: string): BitcoinTransactionId => {
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error(`Invalid Bitcoin txid fixture: ${value}`);
  }
  return value as BitcoinTransactionId;
};

describe('vault lifecycle adapter', () => {
  it('maps pending withdrawal records to sent lifecycle state when source snapshot is empty', () => {
    const lifecycleStatus = deriveVaultLifecycleStatus({
      withdrawalRecord,
      snapshot: {
        status: 'safe',
        isUnavailable: false,
        tokenCount: 0,
        totalBalance: 0
      }
    });

    if (lifecycleStatus.kind !== 'sent') {
      throw new Error('Expected sent lifecycle');
    }

    expect(lifecycleStatus.confirmedAt).toBe(withdrawalRecord.initiatedAt);
  });

  it('maps pending withdrawal records to pending lifecycle state while source still has balance', () => {
    const lifecycleStatus = deriveVaultLifecycleStatus({
      withdrawalRecord,
      snapshot: {
        status: 'safe',
        isUnavailable: false,
        tokenCount: 1,
        totalBalance: 10
      }
    });

    expect(lifecycleStatus.kind).toBe('pending');
  });

  it('maps sent withdrawal records to sent lifecycle state', () => {
    const lifecycleStatus = deriveVaultLifecycleStatus({
      withdrawalRecord: {
        ...withdrawalRecord,
        status: 'sent',
        sentAt: 1_710_000_500_000
      },
      snapshot: {
        status: 'safe',
        isUnavailable: false,
        tokenCount: 1,
        totalBalance: 10
      }
    });

    if (lifecycleStatus.kind !== 'sent') {
      throw new Error('Expected sent lifecycle');
    }

    expect(lifecycleStatus.confirmedAt).toBe(1_710_000_500_000);
  });

  it('maps withdrawn withdrawal records to terminal withdrawn lifecycle state', () => {
    const lifecycleStatus = deriveVaultLifecycleStatus({
      withdrawalRecord: {
        ...withdrawalRecord,
        status: 'withdrawn',
        completedAt: 1_710_000_500_000,
        txRefs: [
          {
            chain: 'evm',
            data: {
              txHash: '0xabc',
              userOpHash: '0xuserop',
              explorerUrl: null
            }
          }
        ]
      },
      snapshot: {
        status: 'safe',
        isUnavailable: false,
        tokenCount: 0,
        totalBalance: 42
      }
    });

    expect(lifecycleStatus.kind).toBe('withdrawn');
  });

  it('maps withdrawn records to withdrawn when snapshot status is already withdrawn even if token count is non-zero', () => {
    const lifecycleStatus = deriveVaultLifecycleStatus({
      withdrawalRecord: {
        ...withdrawalRecord,
        status: 'withdrawn',
        completedAt: 1_710_000_500_000
      },
      snapshot: {
        status: 'withdrawn',
        isUnavailable: false,
        tokenCount: 2,
        totalBalance: 42
      }
    });

    expect(lifecycleStatus.kind).toBe('withdrawn');
  });

  it('falls back to snapshot status when a withdrawn record is stale and balance is non-zero', () => {
    const lifecycleStatus = deriveVaultLifecycleStatus({
      withdrawalRecord: {
        ...withdrawalRecord,
        status: 'withdrawn',
        completedAt: 1_710_000_500_000
      },
      snapshot: {
        status: 'vulnerable',
        isUnavailable: false,
        tokenCount: 2,
        totalBalance: 42
      }
    });

    expect(lifecycleStatus.kind).toBe('vulnerable');
  });

  it('maps failed withdrawal records to snapshot fallback status', () => {
    const failedLifecycleStatus = deriveVaultLifecycleStatus({
      withdrawalRecord: {
        ...withdrawalRecord,
        status: 'failed',
        failedAt: 1_710_000_500_000
      },
      snapshot: {
        status: 'vulnerable',
        isUnavailable: false,
        tokenCount: 2,
        totalBalance: 42
      }
    });

    expect(failedLifecycleStatus.kind).toBe('vulnerable');
  });

  it('throws when a sent record is missing the SDK-invariant sentAt timestamp', () => {
    expect(() =>
      deriveVaultLifecycleStatus({
        withdrawalRecord: {
          ...withdrawalRecord,
          status: 'sent',
          sentAt: null
        },
        snapshot: {
          status: 'safe',
          isUnavailable: false,
          tokenCount: 1,
          totalBalance: 1
        }
      })
    ).toThrow(/sentAt for withdrawal record record-1 in sent state/);
  });

  it('throws when a withdrawn record is missing the SDK-invariant completedAt timestamp', () => {
    expect(() =>
      deriveVaultLifecycleStatus({
        withdrawalRecord: {
          ...withdrawalRecord,
          status: 'withdrawn',
          completedAt: null
        },
        snapshot: {
          status: 'safe',
          isUnavailable: false,
          tokenCount: 0,
          totalBalance: 0
        }
      })
    ).toThrow(/completedAt for withdrawn withdrawal record record-1/);
  });

  it('falls back to snapshot status when there is no withdrawal record', () => {
    const lifecycleStatus = deriveVaultLifecycleStatus({
      withdrawalRecord: undefined,
      snapshot: {
        status: 'safe',
        isUnavailable: false,
        tokenCount: 0,
        totalBalance: 0
      }
    });

    expect(lifecycleStatus.kind).toBe('safe');
  });

  it('maps no-record withdrawn snapshots to withdrawn lifecycle without fabricated metadata', () => {
    const lifecycleStatus = deriveVaultLifecycleStatus({
      withdrawalRecord: undefined,
      snapshot: {
        status: 'withdrawn',
        isUnavailable: false,
        tokenCount: 0,
        totalBalance: 0
      }
    });

    if (lifecycleStatus.kind !== 'withdrawn') {
      throw new Error('Expected withdrawn lifecycle');
    }

    expect(lifecycleStatus.completedAt).toBeNull();
    expect(lifecycleStatus.destinationAddress).toBeNull();
    expect(lifecycleStatus.txRefs).toEqual([]);
  });

  it('maps no-record exposed empty snapshots to withdrawn lifecycle after recovery', () => {
    const lifecycleStatus = deriveVaultLifecycleStatus({
      withdrawalRecord: undefined,
      snapshot: {
        status: 'vulnerable',
        isUnavailable: false,
        tokenCount: 0,
        totalBalance: 0
      }
    });

    expect(lifecycleStatus.kind).toBe('withdrawn');
  });

  it('keeps no-record unavailable exposed snapshots vulnerable', () => {
    const lifecycleStatus = deriveVaultLifecycleStatus({
      withdrawalRecord: undefined,
      snapshot: {
        status: 'vulnerable',
        isUnavailable: true,
        tokenCount: 0,
        totalBalance: 0
      }
    });

    expect(lifecycleStatus.kind).toBe('vulnerable');
  });

  it('extracts tx refs from SDK tx identifier shape', () => {
    const txRefs = getWithdrawalTxRefs({
      ...withdrawalRecord,
      txRefs: [
        {
          chain: 'evm',
          data: {
            txHash: '0xabc',
            userOpHash: '0xuserop',
            explorerUrl: null
          }
        },
        {
          chain: 'bitcoin',
          data: {
            txid: toBitcoinTransactionId(
              'f95d7c8a7d2dfdf321f0e29d4f801722f2869bf5c35b76e3b50f9fca2b68d940'
            ),
            explorerUrl: null
          }
        }
      ]
    });

    expect(txRefs).toEqual([
      '0xabc',
      'f95d7c8a7d2dfdf321f0e29d4f801722f2869bf5c35b76e3b50f9fca2b68d940'
    ]);
  });

  it('chooses the lexicographically higher id when initiatedAt timestamps match', () => {
    const latest = getLatestWithdrawalRecord([
      { ...withdrawalRecord, id: 'record-a' },
      { ...withdrawalRecord, id: 'record-b' }
    ]);

    expect(latest?.id).toBe('record-b');
  });
});
