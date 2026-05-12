import { describe, expect, it } from 'vitest';

import type { WithdrawalRecord } from '@project-eleven/libqc';

import {
  buildLatestWithdrawalRecordByAccountId,
  isPostWithdrawComplete,
  loadLatestWithdrawalRecordByAccountId,
  mergeLatestWithdrawalRecordByAccountId,
  resolvePostWithdrawSourceState,
  selectWithdrawalRecordToReconcile
} from './withdrawal-lifecycle';

const createWithdrawalRecord = (
  overrides: Partial<WithdrawalRecord> = {}
): WithdrawalRecord => ({
  id: 'record-1',
  accountId: 'account-1',
  destinationAddress: '0x1111111111111111111111111111111111111111',
  destinationChain: 'eip155:1',
  initiatedAt: 1_710_000_000_000,
  sentAt: null,
  completedAt: null,
  failedAt: null,
  status: 'pending',
  txRefs: [],
  ...overrides
});

const createSummaryAccount = (accountId: string) => ({
  id: { toString: () => accountId }
});

describe('wallet-provider lifecycle helpers', () => {
  it('loads latest records when vault supports listWithdrawals', async () => {
    const result = await loadLatestWithdrawalRecordByAccountId({
      accounts: [createSummaryAccount('account-1')],
      vault: {
        listWithdrawals: async () => [
          createWithdrawalRecord({ id: 'old', initiatedAt: 1 }),
          createWithdrawalRecord({ id: 'new', initiatedAt: 2 })
        ]
      }
    });

    expect(result['account-1']?.id).toBe('new');
  });

  it('passes each account id to listWithdrawals', async () => {
    const requestedAccountIds: Array<string> = [];

    await loadLatestWithdrawalRecordByAccountId({
      accounts: [
        createSummaryAccount('account-1'),
        createSummaryAccount('account-2')
      ],
      vault: {
        listWithdrawals: async (accountId: { toString(): string }) => {
          requestedAccountIds.push(accountId.toString());
          return [];
        }
      }
    });

    expect(requestedAccountIds).toEqual(['account-1', 'account-2']);
  });

  it('keeps successful accounts when one listWithdrawals call fails', async () => {
    const result = await loadLatestWithdrawalRecordByAccountId({
      accounts: [
        createSummaryAccount('account-ok'),
        createSummaryAccount('account-fail')
      ],
      vault: {
        listWithdrawals: async (accountId: { toString(): string }) => {
          if (accountId.toString() === 'account-fail') {
            throw new Error('temporary failure');
          }
          return [
            createWithdrawalRecord({ id: 'older', initiatedAt: 1 }),
            createWithdrawalRecord({ id: 'newer', initiatedAt: 2 })
          ];
        }
      }
    });

    expect(result['account-ok']?.id).toBe('newer');
    expect(result['account-fail']).toBeUndefined();
  });

  it('stores latest withdrawal record for an account', () => {
    const next = buildLatestWithdrawalRecordByAccountId({
      accountId: 'account-1',
      records: [
        createWithdrawalRecord({
          id: 'older',
          initiatedAt: 10
        }),
        createWithdrawalRecord({
          id: 'newer',
          initiatedAt: 20
        })
      ],
      previous: {}
    });

    expect(next['account-1']?.id).toBe('newer');
  });

  it('preserves in-flight previous records when loaded records are missing', () => {
    const previousRecord = createWithdrawalRecord({
      id: 'previous-pending',
      status: 'pending',
      initiatedAt: 20
    });

    const next = mergeLatestWithdrawalRecordByAccountId({
      previous: {
        'account-1': previousRecord
      },
      loaded: {}
    });

    expect(next['account-1']).toEqual(previousRecord);
  });

  it('drops non-in-flight previous records when loaded records are missing', () => {
    const previousRecord = createWithdrawalRecord({
      id: 'previous-withdrawn',
      status: 'withdrawn',
      initiatedAt: 20
    });

    const next = mergeLatestWithdrawalRecordByAccountId({
      previous: {
        'account-1': previousRecord
      },
      loaded: {}
    });

    expect(next['account-1']).toBeUndefined();
  });

  it('keeps newer previous record when loaded record is older', () => {
    const previousRecord = createWithdrawalRecord({
      id: 'previous-newer',
      status: 'pending',
      initiatedAt: 30
    });
    const loadedRecord = createWithdrawalRecord({
      id: 'loaded-older',
      status: 'sent',
      initiatedAt: 10
    });

    const next = mergeLatestWithdrawalRecordByAccountId({
      previous: {
        'account-1': previousRecord
      },
      loaded: {
        'account-1': loadedRecord
      }
    });

    expect(next['account-1']).toEqual(previousRecord);
  });

  it('keeps newer previous record when sdk returns only older records', () => {
    const optimisticRecord = createWithdrawalRecord({
      id: 'optimistic',
      status: 'pending',
      initiatedAt: 100
    });
    const olderHistorical = createWithdrawalRecord({
      id: 'older-historical',
      status: 'withdrawn',
      initiatedAt: 50
    });

    const next = buildLatestWithdrawalRecordByAccountId({
      accountId: 'account-1',
      records: [olderHistorical],
      previous: {
        'account-1': optimisticRecord
      }
    });

    expect(next['account-1']).toEqual(optimisticRecord);
  });

  it('keeps in-flight account record when SDK returns no records', () => {
    const next = buildLatestWithdrawalRecordByAccountId({
      accountId: 'account-1',
      records: [],
      previous: {
        'account-1': createWithdrawalRecord({
          status: 'pending'
        })
      }
    });

    expect(next['account-1']?.status).toBe('pending');
  });

  it('removes terminal account record when SDK returns no records', () => {
    const next = buildLatestWithdrawalRecordByAccountId({
      accountId: 'account-1',
      records: [],
      previous: {
        'account-1': createWithdrawalRecord({
          status: 'withdrawn',
          completedAt: 1_710_000_200_000
        })
      }
    });

    expect(next['account-1']).toBeUndefined();
  });

  it('marks post-withdraw source as terminal when latest SDK record is withdrawn', () => {
    const isTerminal = resolvePostWithdrawSourceState({
      sourceAccountId: 'account-1',
      summaryAccounts: [createSummaryAccount('account-1')],
      sourceLatestWithdrawalRecord: createWithdrawalRecord({
        status: 'withdrawn',
        completedAt: 1_710_000_100_000
      }),
      sourceSnapshot: undefined
    });

    expect(isTerminal).toBe(true);
  });

  it('does not treat failed source lifecycle as terminal', () => {
    const isTerminal = resolvePostWithdrawSourceState({
      sourceAccountId: 'account-1',
      summaryAccounts: [createSummaryAccount('account-1')],
      sourceLatestWithdrawalRecord: createWithdrawalRecord({
        status: 'failed',
        failedAt: 1_710_000_100_000
      }),
      sourceSnapshot: {
        status: 'vulnerable',
        isUnavailable: false,
        tokenCount: 0,
        totalBalance: 0
      }
    });

    expect(isTerminal).toBe(false);
  });

  it('selects latest in-flight reconcile candidate by initiatedAt and id tie-breaker', () => {
    const selected = selectWithdrawalRecordToReconcile({
      latestWithdrawalRecordByAccountId: {
        'account-1': createWithdrawalRecord({
          id: 'record-a',
          status: 'pending',
          initiatedAt: 100
        }),
        'account-2': createWithdrawalRecord({
          id: 'record-b',
          status: 'pending',
          initiatedAt: 100
        }),
        'account-3': createWithdrawalRecord({
          id: 'record-c',
          status: 'sent',
          initiatedAt: 90
        })
      },
      accounts: [
        createSummaryAccount('account-1'),
        createSummaryAccount('account-2'),
        createSummaryAccount('account-3')
      ],
      inFlightWithdrawalRecordIds: new Set(),
      settledWithdrawalRecordIds: new Set()
    });

    expect(selected?.accountId).toBe('account-2');
    expect(selected?.record.id).toBe('record-b');
  });

  it('does not select records already tracked as in-flight or settled', () => {
    const selected = selectWithdrawalRecordToReconcile({
      latestWithdrawalRecordByAccountId: {
        'account-1': createWithdrawalRecord({
          id: 'record-in-flight',
          status: 'pending',
          initiatedAt: 100
        }),
        'account-2': createWithdrawalRecord({
          id: 'record-settled',
          status: 'sent',
          initiatedAt: 200
        }),
        'account-3': createWithdrawalRecord({
          id: 'record-eligible',
          status: 'pending',
          initiatedAt: 50
        })
      },
      accounts: [
        createSummaryAccount('account-1'),
        createSummaryAccount('account-2'),
        createSummaryAccount('account-3')
      ],
      inFlightWithdrawalRecordIds: new Set(['record-in-flight']),
      settledWithdrawalRecordIds: new Set(['record-settled'])
    });

    expect(selected?.accountId).toBe('account-3');
    expect(selected?.record.id).toBe('record-eligible');
  });

  it('treats source as terminal when snapshot already reflects post-withdraw with no lifecycle record', () => {
    const isTerminal = resolvePostWithdrawSourceState({
      sourceAccountId: 'account-1',
      summaryAccounts: [createSummaryAccount('account-1')],
      sourceLatestWithdrawalRecord: undefined,
      sourceSnapshot: {
        status: 'withdrawn',
        isUnavailable: false,
        tokenCount: 0,
        totalBalance: 0
      }
    });

    expect(isTerminal).toBe(true);
  });

  it('uses source snapshot as reconciliation signal for pending SDK record', () => {
    const isTerminal = resolvePostWithdrawSourceState({
      sourceAccountId: 'account-1',
      summaryAccounts: [createSummaryAccount('account-1')],
      sourceLatestWithdrawalRecord: createWithdrawalRecord({
        status: 'pending'
      }),
      sourceSnapshot: {
        status: 'safe',
        isUnavailable: false,
        tokenCount: 0,
        totalBalance: 0
      }
    });

    expect(isTerminal).toBe(true);
  });

  it('treats source as complete when source account is no longer visible', () => {
    const isTerminal = resolvePostWithdrawSourceState({
      sourceAccountId: 'missing-account',
      summaryAccounts: [],
      sourceLatestWithdrawalRecord: undefined,
      sourceSnapshot: undefined
    });

    expect(isTerminal).toBe(true);
  });
});

describe('isPostWithdrawComplete', () => {
  const replacementAccount = { id: { toString: () => 'replacement-1' } };

  it('returns false when the source has not yet reflected the withdraw', () => {
    expect(
      isPostWithdrawComplete({
        ownedDestinationAccountId: undefined,
        replacementAccount,
        sourceReflectsPostWithdraw: false
      })
    ).toBe(false);
  });

  it('returns true when the source reflects post-withdraw and a replacement was minted', () => {
    expect(
      isPostWithdrawComplete({
        ownedDestinationAccountId: undefined,
        replacementAccount,
        sourceReflectsPostWithdraw: true
      })
    ).toBe(true);
  });

  it('returns true when the source reflects post-withdraw and destination is an owned vault, even without a new replacement', () => {
    expect(
      isPostWithdrawComplete({
        ownedDestinationAccountId: 'owned-destination',
        replacementAccount: undefined,
        sourceReflectsPostWithdraw: true
      })
    ).toBe(true);
  });

  it('returns false when neither a replacement account nor an owned destination is present, even if source reflects post-withdraw', () => {
    expect(
      isPostWithdrawComplete({
        ownedDestinationAccountId: undefined,
        replacementAccount: undefined,
        sourceReflectsPostWithdraw: true
      })
    ).toBe(false);
  });
});
