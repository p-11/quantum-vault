import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@project-eleven/libqc', () => ({}));

vi.mock('@/lib/utils', () => ({
  getInterfaceAssets: vi.fn(assets => assets),
  getPositiveNonInterfaceAssetBalances: vi.fn(() => []),
  totalCurrencyValue: vi.fn()
}));

import {
  getPositiveNonInterfaceAssetBalances,
  totalCurrencyValue
} from '@/lib/utils';

import { vaultSnapshotsQueryOptions } from './hooks';
import { vaultQueryKeys } from './query-keys';
import { resolveSnapshotWithStickyStatus } from './snapshot-status';

const mockedTotalCurrencyValue = vi.mocked(totalCurrencyValue);
const mockedGetPositiveNonInterfaceAssetBalances = vi.mocked(
  getPositiveNonInterfaceAssetBalances
);

const createAccount = () => ({
  id: {
    toString: () => 'account-1'
  },
  address: '0x0000000000000000000000000000000000000001',
  chainId: {
    toString: () => 'eip155:1'
  }
});

const createSnapshotsHarness = ({
  sessionId = 7
}: { sessionId?: number } = {}) => {
  const account = createAccount();
  const getStatus = vi.fn(async () => 'safe' as const);
  const listAssets = vi.fn(async () => []);
  const getBalances = vi.fn(async () => []);
  const getAccount = vi.fn(async () => ({
    getStatus,
    listAssets,
    getBalances
  }));
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });
  const queryInput = {
    accounts: [account],
    vault: {
      getAccount
    },
    currency: 'usd',
    sessionId,
    queryClient,
    stickyStatusByAccountId: {}
  } satisfies Parameters<typeof vaultSnapshotsQueryOptions>[0];
  const options = vaultSnapshotsQueryOptions(queryInput);

  return {
    account,
    getAccount,
    getStatus,
    listAssets,
    getBalances,
    queryClient,
    options
  };
};

afterEach(() => {
  mockedGetPositiveNonInterfaceAssetBalances.mockReset();
  mockedGetPositiveNonInterfaceAssetBalances.mockReturnValue([]);
  mockedTotalCurrencyValue.mockReset();
});

describe('resolveSnapshotWithStickyStatus', () => {
  it('keeps the previous status when the next status is unavailable', () => {
    const resolved = resolveSnapshotWithStickyStatus({
      next: {
        isUnavailable: true,
        status: null,
        tokenCount: null,
        totalBalance: null
      },
      previousStatus: 'vulnerable'
    });

    expect(resolved.status).toBe('vulnerable');
  });

  it('prefers the next status when it is present', () => {
    const resolved = resolveSnapshotWithStickyStatus({
      next: {
        isUnavailable: false,
        status: 'withdrawn',
        tokenCount: 0,
        totalBalance: 0
      },
      previousStatus: 'vulnerable'
    });

    expect(resolved.status).toBe('withdrawn');
  });

  it('falls back to safe when both next and previous statuses are missing', () => {
    const resolved = resolveSnapshotWithStickyStatus({
      next: {
        isUnavailable: true,
        status: null,
        tokenCount: null,
        totalBalance: null
      },
      previousStatus: null
    });

    expect(resolved.status).toBe('safe');
  });
});

describe('vaultSnapshotsQueryOptions', () => {
  it('reuses cached snapshots until explicit invalidation', async () => {
    mockedTotalCurrencyValue.mockResolvedValue(42);

    const {
      account,
      getAccount,
      getStatus,
      listAssets,
      getBalances,
      queryClient,
      options
    } = createSnapshotsHarness();

    const firstResult = await queryClient.fetchQuery(options);
    const secondResult = await queryClient.fetchQuery(options);

    expect(firstResult[account.id.toString()]).toEqual({
      isUnavailable: false,
      status: 'safe',
      tokenCount: 0,
      totalBalance: 42
    });
    expect(
      queryClient.getQueryData(
        vaultQueryKeys.vaultDetail({
          sessionId: 7,
          accountId: account.id.toString(),
          currency: 'usd'
        })
      )
    ).toEqual(
      expect.objectContaining({
        assets: [],
        balances: [],
        vaultState: 'safe',
        totalCurrencyValue: 42
      })
    );
    expect(secondResult).toEqual(firstResult);
    expect(options.staleTime).toBe(Infinity);
    expect(getAccount).toHaveBeenCalledTimes(1);
    expect(getStatus).toHaveBeenCalledTimes(1);
    expect(listAssets).toHaveBeenCalledTimes(1);
    expect(getBalances).toHaveBeenCalledTimes(1);

    await queryClient.invalidateQueries({
      queryKey: vaultQueryKeys.snapshotsScope({
        sessionId: 7,
        currency: 'usd'
      })
    });
    await queryClient.fetchQuery(options);

    expect(getAccount).toHaveBeenCalledTimes(2);
    expect(getStatus).toHaveBeenCalledTimes(2);
    expect(listAssets).toHaveBeenCalledTimes(2);
    expect(getBalances).toHaveBeenCalledTimes(2);
  });

  it('uses session id to scope snapshot cache reuse', async () => {
    mockedTotalCurrencyValue.mockResolvedValue(42);

    const firstSession = createSnapshotsHarness({ sessionId: 7 });
    const nextSession = createSnapshotsHarness({ sessionId: 8 });

    await firstSession.queryClient.fetchQuery(firstSession.options);
    await nextSession.queryClient.fetchQuery(nextSession.options);

    expect(firstSession.getAccount).toHaveBeenCalledTimes(1);
    expect(nextSession.getAccount).toHaveBeenCalledTimes(1);
    expect(firstSession.options.queryKey).not.toEqual(
      nextSession.options.queryKey
    );
  });

  it('counts hidden positive token balances and preloads their withdraw guard state', async () => {
    mockedTotalCurrencyValue.mockResolvedValue(42);
    mockedGetPositiveNonInterfaceAssetBalances.mockReturnValueOnce([
      {
        asset: {
          symbol: 'USDC'
        },
        balance: {
          symbol: 'USDC',
          balance: 1n
        }
      }
    ]);

    const { account, queryClient, options } = createSnapshotsHarness();

    const result = await queryClient.fetchQuery(options);

    expect(result[account.id.toString()]).toEqual({
      isUnavailable: false,
      status: 'safe',
      tokenCount: 1,
      totalBalance: 42
    });
    expect(
      queryClient.getQueryData(
        vaultQueryKeys.vaultDetail({
          sessionId: 7,
          accountId: account.id.toString(),
          currency: 'usd'
        })
      )
    ).toEqual(
      expect.objectContaining({
        hasNonInterfaceAssetBalance: true
      })
    );
  });

  it('does not prefill vault detail query data when status resolution fails', async () => {
    mockedTotalCurrencyValue.mockResolvedValue(42);

    const account = createAccount();
    const getStatus = vi.fn(async () => {
      throw new Error('status unavailable');
    });
    const listAssets = vi.fn(async () => []);
    const getBalances = vi.fn(async () => []);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        }
      }
    });

    const options = vaultSnapshotsQueryOptions({
      accounts: [account],
      vault: {
        listAssets: async () => [],
        getTotalBalances: async () => [],
        getAccount: async () => ({
          getStatus,
          listAssets,
          getBalances
        })
      },
      currency: 'usd',
      sessionId: 7,
      queryClient,
      stickyStatusByAccountId: {}
    });

    await queryClient.fetchQuery(options);

    expect(
      queryClient.getQueryData(
        vaultQueryKeys.vaultDetail({
          sessionId: 7,
          accountId: account.id.toString(),
          currency: 'usd'
        })
      )
    ).toBeUndefined();
  });

  it('clears stale inactive vault detail query data when status resolution fails', async () => {
    mockedTotalCurrencyValue.mockResolvedValue(42);

    const account = createAccount();
    const detailQueryKey = vaultQueryKeys.vaultDetail({
      sessionId: 7,
      accountId: account.id.toString(),
      currency: 'usd'
    });
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        }
      }
    });
    queryClient.setQueryData(detailQueryKey, {
      assets: ['stale'],
      balances: ['stale'],
      vaultState: 'safe',
      totalCurrencyValue: 999
    });

    const options = vaultSnapshotsQueryOptions({
      accounts: [account],
      vault: {
        listAssets: async () => [],
        getTotalBalances: async () => [],
        getAccount: async () => ({
          getStatus: async () => {
            throw new Error('status unavailable');
          },
          listAssets: async () => [],
          getBalances: async () => []
        })
      },
      currency: 'usd',
      sessionId: 7,
      queryClient,
      stickyStatusByAccountId: {}
    });

    await queryClient.fetchQuery(options);

    expect(queryClient.getQueryData(detailQueryKey)).toBeUndefined();
  });

  it('does not overwrite existing vault detail query data from a newer fetch', async () => {
    mockedTotalCurrencyValue.mockResolvedValue(42);

    const { account, queryClient, options } = createSnapshotsHarness();
    const detailQueryKey = vaultQueryKeys.vaultDetail({
      sessionId: 7,
      accountId: account.id.toString(),
      currency: 'usd'
    });
    const existingDetail = {
      assets: ['latest'],
      balances: ['latest'],
      vaultState: 'safe',
      totalCurrencyValue: 777
    };

    queryClient.setQueryData(detailQueryKey, existingDetail);
    await queryClient.fetchQuery(options);

    expect(queryClient.getQueryData(detailQueryKey)).toEqual(existingDetail);
  });

  it.each([
    {
      name: 'listing account assets fails',
      buildAccountClient: () => ({
        getStatus: async () => 'safe' as const,
        listAssets: async () => {
          throw new Error('assets unavailable');
        },
        getBalances: async () => []
      }),
      configureTotals: () => mockedTotalCurrencyValue.mockResolvedValue(42)
    },
    {
      name: 'fetching account balances fails',
      buildAccountClient: () => ({
        getStatus: async () => 'safe' as const,
        listAssets: async () => [],
        getBalances: async () => {
          throw new Error('balances unavailable');
        }
      }),
      configureTotals: () => mockedTotalCurrencyValue.mockResolvedValue(42)
    },
    {
      name: 'computing total balance fails',
      buildAccountClient: () => ({
        getStatus: async () => 'safe' as const,
        listAssets: async () => [],
        getBalances: async () => []
      }),
      configureTotals: () =>
        mockedTotalCurrencyValue.mockRejectedValue(
          new Error('total unavailable')
        )
    }
  ])('clears stale vault detail cache when $name', async failureCase => {
    failureCase.configureTotals();

    const account = createAccount();
    const detailQueryKey = vaultQueryKeys.vaultDetail({
      sessionId: 7,
      accountId: account.id.toString(),
      currency: 'usd'
    });
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        }
      }
    });
    queryClient.setQueryData(detailQueryKey, {
      assets: ['stale'],
      balances: ['stale'],
      vaultState: 'safe',
      totalCurrencyValue: 555
    });

    const options = vaultSnapshotsQueryOptions({
      accounts: [account],
      vault: {
        listAssets: async () => [],
        getTotalBalances: async () => [],
        getAccount: async () => failureCase.buildAccountClient()
      },
      currency: 'usd',
      sessionId: 7,
      queryClient,
      stickyStatusByAccountId: {}
    });

    await queryClient.fetchQuery(options);

    expect(queryClient.getQueryData(detailQueryKey)).toBeUndefined();
  });
});
