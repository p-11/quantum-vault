import { describe, expect, it, vi } from 'vitest';
import type { WithdrawalRecord } from '@project-eleven/libqc';

import type { VaultSnapshot } from '@/modules/vaults/types';

import {
  lifecyclePolicyByKind,
  resolveVaultLifecycleAccountReadModel
} from './account-read-model';

vi.mock('@project-eleven/libqc', () => ({}));

const createAccount = ({
  id,
  address = `0x${id}`,
  chainReference = '1'
}: {
  id: string;
  address?: string;
  chainReference?: string;
}) => ({
  id: {
    toString: () => id
  },
  address,
  chainId: {
    namespace: 'eip155',
    reference: chainReference,
    toString: () => `eip155:${chainReference}`
  }
});

const createSnapshot = (
  overrides: Partial<VaultSnapshot> = {}
): VaultSnapshot => ({
  isUnavailable: false,
  status: 'safe',
  tokenCount: 1,
  totalBalance: 1,
  ...overrides
});

const createWithdrawalRecord = ({
  accountId,
  status,
  ...overrides
}: Pick<WithdrawalRecord, 'accountId' | 'status'> &
  Partial<WithdrawalRecord>): WithdrawalRecord => ({
  id: `${accountId}-${status}`,
  accountId,
  destinationAddress: '0x1111111111111111111111111111111111111111',
  destinationChain: 'eip155:1',
  initiatedAt: 1_710_000_000_000,
  sentAt: null,
  completedAt: null,
  failedAt: null,
  status,
  txRefs: [],
  ...overrides
});

describe('vault lifecycle account read model', () => {
  it('keeps lifecycle policy exhaustive by lifecycle kind', () => {
    expect(lifecyclePolicyByKind).toEqual({
      safe: { depositEligible: true, homeStatus: 'safe' },
      vulnerable: { depositEligible: false, homeStatus: 'vulnerable' },
      pending: { depositEligible: false, homeStatus: 'withdrawn' },
      sent: { depositEligible: false, homeStatus: 'withdrawn' },
      withdrawn: { depositEligible: false, homeStatus: 'withdrawn' }
    });
  });

  it('returns lifecycle rows only for accounts with present snapshots', () => {
    const accounts = [
      createAccount({ id: 'with-snapshot' }),
      createAccount({ id: 'missing-snapshot' })
    ] satisfies Parameters<
      typeof resolveVaultLifecycleAccountReadModel
    >[0]['accounts'];

    const readModel = resolveVaultLifecycleAccountReadModel({
      accounts,
      vaultSnapshotByAccountId: {
        'with-snapshot': createSnapshot()
      },
      latestWithdrawalRecordByAccountId: {}
    });

    expect(readModel.accounts.map(({ accountId }) => accountId)).toEqual([
      'with-snapshot'
    ]);
    expect(readModel.getLifecycleKindForAccountId('with-snapshot')).toBe(
      'safe'
    );
  });

  it('returns only present available safe lifecycle accounts for deposits', () => {
    const accounts = [
      createAccount({ id: 'safe-account' }),
      createAccount({ id: 'vulnerable-account' }),
      createAccount({ id: 'missing-snapshot-account' }),
      createAccount({ id: 'unavailable-account' }),
      createAccount({ id: 'null-status-account' })
    ] satisfies Parameters<
      typeof resolveVaultLifecycleAccountReadModel
    >[0]['accounts'];

    const readModel = resolveVaultLifecycleAccountReadModel({
      accounts,
      vaultSnapshotByAccountId: {
        'safe-account': createSnapshot(),
        'vulnerable-account': createSnapshot({ status: 'vulnerable' }),
        'unavailable-account': createSnapshot({ isUnavailable: true }),
        'null-status-account': createSnapshot({ status: null })
      },
      latestWithdrawalRecordByAccountId: {}
    });

    expect(
      readModel.depositEligibleAccounts.map(({ accountId }) => accountId)
    ).toEqual(['safe-account']);
  });

  it('uses withdrawal records over safe snapshots for deposit eligibility', () => {
    const accounts = [
      createAccount({ id: 'pending-safe-snapshot' }),
      createAccount({ id: 'sent-safe-snapshot' }),
      createAccount({ id: 'withdrawn-safe-snapshot' })
    ] satisfies Parameters<
      typeof resolveVaultLifecycleAccountReadModel
    >[0]['accounts'];

    const readModel = resolveVaultLifecycleAccountReadModel({
      accounts,
      vaultSnapshotByAccountId: {
        'pending-safe-snapshot': createSnapshot({ status: 'safe' }),
        'sent-safe-snapshot': createSnapshot({ status: 'safe' }),
        'withdrawn-safe-snapshot': createSnapshot({
          status: 'safe',
          tokenCount: 0
        })
      },
      latestWithdrawalRecordByAccountId: {
        'pending-safe-snapshot': createWithdrawalRecord({
          accountId: 'pending-safe-snapshot',
          status: 'pending'
        }),
        'sent-safe-snapshot': createWithdrawalRecord({
          accountId: 'sent-safe-snapshot',
          status: 'sent',
          sentAt: 1_710_000_001_000
        }),
        'withdrawn-safe-snapshot': createWithdrawalRecord({
          accountId: 'withdrawn-safe-snapshot',
          status: 'withdrawn',
          completedAt: 1_710_000_002_000
        })
      }
    });

    expect(readModel.depositEligibleAccounts).toEqual([]);
  });

  it('restores failed withdrawal records to snapshot-derived lifecycle buckets', () => {
    const accounts = [
      createAccount({ id: 'safe-failed-account' }),
      createAccount({ id: 'vulnerable-failed-account' })
    ] satisfies Parameters<
      typeof resolveVaultLifecycleAccountReadModel
    >[0]['accounts'];

    const readModel = resolveVaultLifecycleAccountReadModel({
      accounts,
      vaultSnapshotByAccountId: {
        'safe-failed-account': createSnapshot({ status: 'safe' }),
        'vulnerable-failed-account': createSnapshot({ status: 'vulnerable' })
      },
      latestWithdrawalRecordByAccountId: {
        'safe-failed-account': createWithdrawalRecord({
          accountId: 'safe-failed-account',
          status: 'failed',
          failedAt: 1_710_000_003_000
        }),
        'vulnerable-failed-account': createWithdrawalRecord({
          accountId: 'vulnerable-failed-account',
          status: 'failed',
          failedAt: 1_710_000_004_000
        })
      }
    });

    expect(readModel.getLifecycleKindForAccountId('safe-failed-account')).toBe(
      'safe'
    );
    expect(
      readModel.getLifecycleKindForAccountId('vulnerable-failed-account')
    ).toBe('vulnerable');
    expect(
      readModel.accountsByHomeStatus.safe.map(account => account.id.toString())
    ).toEqual(['safe-failed-account']);
    expect(
      readModel.accountsByHomeStatus.vulnerable.map(account =>
        account.id.toString()
      )
    ).toEqual(['vulnerable-failed-account']);
    expect(
      readModel.depositEligibleAccounts.map(({ accountId }) => accountId)
    ).toEqual(['safe-failed-account']);
  });

  it('groups lifecycle-derived accounts into home section buckets', () => {
    const accounts = [
      createAccount({ id: 'safe-account' }),
      createAccount({ id: 'vulnerable-account' }),
      createAccount({ id: 'pending-account' }),
      createAccount({ id: 'sent-account' }),
      createAccount({ id: 'withdrawn-account' })
    ] satisfies Parameters<
      typeof resolveVaultLifecycleAccountReadModel
    >[0]['accounts'];

    const readModel = resolveVaultLifecycleAccountReadModel({
      accounts,
      vaultSnapshotByAccountId: {
        'safe-account': createSnapshot({ status: 'safe' }),
        'vulnerable-account': createSnapshot({ status: 'vulnerable' }),
        'pending-account': createSnapshot({ status: 'safe' }),
        'sent-account': createSnapshot({ status: 'safe' }),
        'withdrawn-account': createSnapshot({
          status: 'withdrawn',
          tokenCount: 2
        })
      },
      latestWithdrawalRecordByAccountId: {
        'pending-account': createWithdrawalRecord({
          accountId: 'pending-account',
          status: 'pending'
        }),
        'sent-account': createWithdrawalRecord({
          accountId: 'sent-account',
          status: 'sent',
          sentAt: 1_710_000_001_000
        }),
        'withdrawn-account': createWithdrawalRecord({
          accountId: 'withdrawn-account',
          status: 'withdrawn',
          completedAt: 1_710_000_002_000
        })
      }
    });

    expect(
      readModel.accountsByHomeStatus.safe.map(account => account.id.toString())
    ).toEqual(['safe-account']);
    expect(
      readModel.accountsByHomeStatus.vulnerable.map(account =>
        account.id.toString()
      )
    ).toEqual(['vulnerable-account']);
    expect(
      readModel.accountsByHomeStatus.withdrawn.map(account =>
        account.id.toString()
      )
    ).toEqual(['pending-account', 'sent-account', 'withdrawn-account']);
    expect(readModel.getLifecycleKindForAccountId('safe-account')).toBe('safe');
    expect(readModel.getLifecycleKindForAccountId('vulnerable-account')).toBe(
      'vulnerable'
    );
    expect(readModel.getLifecycleKindForAccountId('pending-account')).toBe(
      'pending'
    );
    expect(readModel.getLifecycleKindForAccountId('sent-account')).toBe('sent');
    expect(readModel.getLifecycleKindForAccountId('withdrawn-account')).toBe(
      'withdrawn'
    );
  });

  it('groups recovered exposed empty accounts as withdrawn without withdrawal records', () => {
    const accounts = [
      createAccount({ id: 'recovered-empty-account' }),
      createAccount({ id: 'funded-vulnerable-account' })
    ] satisfies Parameters<
      typeof resolveVaultLifecycleAccountReadModel
    >[0]['accounts'];

    const readModel = resolveVaultLifecycleAccountReadModel({
      accounts,
      vaultSnapshotByAccountId: {
        'recovered-empty-account': createSnapshot({
          status: 'vulnerable',
          tokenCount: 0,
          totalBalance: 0
        }),
        'funded-vulnerable-account': createSnapshot({
          status: 'vulnerable',
          tokenCount: 1,
          totalBalance: 1
        })
      },
      latestWithdrawalRecordByAccountId: {}
    });

    expect(
      readModel.accountsByHomeStatus.withdrawn.map(account =>
        account.id.toString()
      )
    ).toEqual(['recovered-empty-account']);
    expect(
      readModel.accountsByHomeStatus.vulnerable.map(account =>
        account.id.toString()
      )
    ).toEqual(['funded-vulnerable-account']);
    expect(readModel.depositEligibleAccounts).toEqual([]);
  });

  it('selects same-chain lifecycle-safe destinations and excludes the source', () => {
    const accounts = [
      createAccount({ id: 'source', chainReference: '1' }),
      createAccount({ id: 'same-chain-safe', chainReference: '1' }),
      createAccount({ id: 'same-chain-pending', chainReference: '1' }),
      createAccount({ id: 'other-chain-safe', chainReference: '137' })
    ] satisfies Parameters<
      typeof resolveVaultLifecycleAccountReadModel
    >[0]['accounts'];

    const readModel = resolveVaultLifecycleAccountReadModel({
      accounts,
      vaultSnapshotByAccountId: {
        source: createSnapshot({ status: 'vulnerable' }),
        'same-chain-safe': createSnapshot({ status: 'safe' }),
        'same-chain-pending': createSnapshot({ status: 'safe' }),
        'other-chain-safe': createSnapshot({ status: 'safe' })
      },
      latestWithdrawalRecordByAccountId: {
        'same-chain-pending': createWithdrawalRecord({
          accountId: 'same-chain-pending',
          status: 'pending'
        })
      }
    });

    expect(
      readModel
        .getSafeDestinationCandidatesFor(accounts[0])
        .map(({ accountId }) => accountId)
    ).toEqual(['same-chain-safe']);
  });

  it('does not suggest destinations for non-vulnerable sources', () => {
    const accounts = [
      createAccount({ id: 'source', chainReference: '1' }),
      createAccount({ id: 'same-chain-safe', chainReference: '1' })
    ] satisfies Parameters<
      typeof resolveVaultLifecycleAccountReadModel
    >[0]['accounts'];

    const readModel = resolveVaultLifecycleAccountReadModel({
      accounts,
      vaultSnapshotByAccountId: {
        source: createSnapshot({ status: 'safe' }),
        'same-chain-safe': createSnapshot({ status: 'safe' })
      },
      latestWithdrawalRecordByAccountId: {}
    });

    expect(readModel.getSafeDestinationCandidatesFor(accounts[0])).toEqual([]);
  });
});
