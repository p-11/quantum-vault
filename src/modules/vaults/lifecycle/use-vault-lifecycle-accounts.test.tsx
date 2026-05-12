import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WithdrawalRecord } from '@project-eleven/libqc';

import type { VaultSnapshot } from '@/modules/vaults/types';

const useVaultAccountSnapshotsQueryMock = vi.hoisted(() => vi.fn());

vi.mock('@project-eleven/libqc', () => ({}));

vi.mock('@/modules/vaults/data/hooks', () => ({
  useVaultAccountSnapshotsQuery: useVaultAccountSnapshotsQueryMock
}));

import { useVaultLifecycleAccounts } from './use-vault-lifecycle-accounts';

afterEach(() => {
  useVaultAccountSnapshotsQueryMock.mockReset();
});

const createAccount = ({
  id,
  chainReference = '1'
}: {
  id: string;
  chainReference?: string;
}) => ({
  id: {
    toString: () => id
  },
  address: `0x${id}`,
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

const createVaultSnapshotsQuery = ({
  data = {},
  status = 'success'
}: {
  data?: Record<string, VaultSnapshot>;
  status?: 'pending' | 'error' | 'success';
} = {}) => ({
  data,
  error: status === 'error' ? new Error('snapshot query failed') : null,
  isError: status === 'error',
  isPending: status === 'pending',
  status
});

const createInput = ({
  accounts = [createAccount({ id: 'account-1' })],
  latestWithdrawalRecordByAccountId = {}
}: Partial<
  Pick<
    Parameters<typeof useVaultLifecycleAccounts>[0],
    'accounts' | 'latestWithdrawalRecordByAccountId'
  >
> = {}): Parameters<typeof useVaultLifecycleAccounts>[0] => ({
  accounts,
  vault: {
    getAccount: vi.fn(),
    listAssets: vi.fn(),
    getTotalBalances: vi.fn()
  },
  currency: 'usd',
  sessionId: 7,
  latestWithdrawalRecordByAccountId
});

describe('useVaultLifecycleAccounts', () => {
  it('propagates snapshot loading state and delegates snapshot inputs', () => {
    const snapshotsQuery = createVaultSnapshotsQuery({ status: 'pending' });
    useVaultAccountSnapshotsQueryMock.mockReturnValue(snapshotsQuery);
    const input = createInput();

    const result = useVaultLifecycleAccounts(input);

    expect(useVaultAccountSnapshotsQueryMock).toHaveBeenCalledWith({
      accounts: input.accounts,
      vault: input.vault,
      currency: input.currency,
      sessionId: input.sessionId
    });
    expect(result.isLoading).toBe(true);
    expect(result.isError).toBe(false);
    expect(result.vaultSnapshotsQuery).toBe(snapshotsQuery);
    expect(result.depositEligibleAccounts).toEqual([]);
  });

  it('composes snapshot data into deposit eligible lifecycle accounts', () => {
    const accounts = [
      createAccount({ id: 'safe-account' }),
      createAccount({ id: 'vulnerable-account' })
    ];
    useVaultAccountSnapshotsQueryMock.mockReturnValue(
      createVaultSnapshotsQuery({
        data: {
          'safe-account': createSnapshot(),
          'vulnerable-account': createSnapshot({ status: 'vulnerable' })
        }
      })
    );

    const result = useVaultLifecycleAccounts(createInput({ accounts }));

    expect(
      result.depositEligibleAccounts.map(({ accountId }) => accountId)
    ).toEqual(['safe-account']);
  });

  it('propagates snapshot query error state', () => {
    useVaultAccountSnapshotsQueryMock.mockReturnValue(
      createVaultSnapshotsQuery({ status: 'error' })
    );

    const result = useVaultLifecycleAccounts(createInput());

    expect(result.isLoading).toBe(false);
    expect(result.isError).toBe(true);
    expect(result.depositEligibleAccounts).toEqual([]);
  });

  it('passes withdrawal records into lifecycle resolution', () => {
    const accounts = [createAccount({ id: 'safe-looking-pending-account' })];
    useVaultAccountSnapshotsQueryMock.mockReturnValue(
      createVaultSnapshotsQuery({
        data: {
          'safe-looking-pending-account': createSnapshot({ status: 'safe' })
        }
      })
    );

    const result = useVaultLifecycleAccounts(
      createInput({
        accounts,
        latestWithdrawalRecordByAccountId: {
          'safe-looking-pending-account': createWithdrawalRecord({
            accountId: 'safe-looking-pending-account',
            status: 'pending'
          })
        }
      })
    );

    expect(result.depositEligibleAccounts).toEqual([]);
    expect(result.accounts.map(({ lifecycleKind }) => lifecycleKind)).toEqual([
      'pending'
    ]);
  });
});
