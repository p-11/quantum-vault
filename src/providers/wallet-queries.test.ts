import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/utils', () => ({
  getInterfaceAssets: vi.fn(assets => assets),
  totalCurrencyValue: vi.fn()
}));

import { totalCurrencyValue } from '@/lib/utils';
import {
  loadWalletBootState,
  loadWalletSummary,
  shouldRefetchWalletSummary,
  walletSummaryQueryOptions
} from '@/providers/wallet-queries';

const mockedTotalCurrencyValue = vi.mocked(totalCurrencyValue);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('loadWalletSummary', () => {
  it('returns degraded summary when listing accounts fails', async () => {
    const vault = {
      listAccounts: async () => {
        throw new Error('failed to list accounts');
      },
      listAssets: async () => [],
      getTotalBalances: async () => []
    };

    const summary = await loadWalletSummary({
      currency: 'usd',
      mode: 'full',
      vault
    });

    expect(summary).toEqual({
      accounts: [],
      assets: [],
      balances: [],
      totalBalance: 0,
      isBalanceProviderUnavailable: true
    });
  });

  it('returns degraded summary when listing assets fails', async () => {
    const vault = {
      listAccounts: async () => [],
      listAssets: async () => {
        throw new Error('failed to list assets');
      },
      getTotalBalances: async () => []
    };

    const summary = await loadWalletSummary({
      currency: 'usd',
      mode: 'full',
      vault
    });

    expect(summary).toEqual({
      accounts: [],
      assets: [],
      balances: [],
      totalBalance: 0,
      isBalanceProviderUnavailable: true
    });
  });

  it('returns degraded summary when balance provider fails', async () => {
    const vault = {
      listAccounts: async () => [],
      listAssets: async () => [],
      getTotalBalances: async () => {
        throw new Error('failed to fetch balances');
      }
    };

    const summary = await loadWalletSummary({
      currency: 'usd',
      mode: 'full',
      vault
    });

    expect(summary).toEqual({
      accounts: [],
      assets: [],
      balances: [],
      totalBalance: 0,
      isBalanceProviderUnavailable: true
    });
  });

  it('returns inventory-only summary without balance provider reads', async () => {
    const getTotalBalances = vi.fn(async () => []);

    const summary = await loadWalletSummary({
      currency: 'usd',
      mode: 'inventory-only',
      vault: {
        listAccounts: async () => [],
        listAssets: async () => [],
        getTotalBalances
      }
    });

    expect(summary).toEqual({
      accounts: [],
      assets: [],
      balances: [],
      totalBalance: 0,
      isBalanceProviderUnavailable: false
    });
    expect(getTotalBalances).not.toHaveBeenCalled();
    expect(mockedTotalCurrencyValue).not.toHaveBeenCalled();
  });

  it('returns ready summary when balances and totals resolve', async () => {
    mockedTotalCurrencyValue.mockResolvedValueOnce(42);

    const vault = {
      listAccounts: async () => [],
      listAssets: async () => [],
      getTotalBalances: async () => []
    };

    const summary = await loadWalletSummary({
      currency: 'usd',
      mode: 'full',
      vault
    });

    expect(summary).toEqual({
      accounts: [],
      assets: [],
      balances: [],
      totalBalance: 42,
      isBalanceProviderUnavailable: false
    });
  });
});

describe('loadWalletBootState', () => {
  it('returns locked state when password exists but vault is locked', async () => {
    const state = await loadWalletBootState({
      hasPassword: async () => true,
      isUnlocked: () => false
    });

    expect(state).toEqual({
      hasPassword: true,
      isUnlocked: false
    });
  });
});

describe('walletSummaryQueryOptions', () => {
  it('defaults to inventory-only query behavior without mount refetch or polling', async () => {
    const getTotalBalances = vi.fn(async () => []);

    const options = walletSummaryQueryOptions({
      currency: 'usd',
      isEnabled: true,
      sessionId: 7,
      vault: {
        listAccounts: async () => [],
        listAssets: async () => [],
        getTotalBalances
      }
    });

    const summary = await options.queryFn();

    expect(summary).toEqual({
      accounts: [],
      assets: [],
      balances: [],
      totalBalance: 0,
      isBalanceProviderUnavailable: false
    });
    expect(getTotalBalances).not.toHaveBeenCalled();
    expect(options.staleTime).toBe(Infinity);
    expect(options.refetchOnMount).toBe(false);
    expect(options.refetchInterval).toBe(false);
  });

  it('keeps polling in full mode when the balance provider is unavailable', () => {
    const options = walletSummaryQueryOptions({
      currency: 'usd',
      isEnabled: true,
      mode: 'full',
      sessionId: 7,
      vault: {
        listAccounts: async () => [],
        listAssets: async () => [],
        getTotalBalances: async () => []
      }
    });

    const refetchInterval = options.refetchInterval;

    if (!refetchInterval) {
      throw new Error('Expected refetch interval callback');
    }

    expect(
      refetchInterval({
        state: {
          data: {
            accounts: [],
            assets: [],
            balances: [],
            totalBalance: 0,
            isBalanceProviderUnavailable: true
          }
        }
      })
    ).toBe(10_000);
  });

  it('does not poll in full mode when the balance provider is healthy', () => {
    const options = walletSummaryQueryOptions({
      currency: 'usd',
      isEnabled: true,
      mode: 'full',
      sessionId: 7,
      vault: {
        listAccounts: async () => [],
        listAssets: async () => [],
        getTotalBalances: async () => []
      }
    });

    const refetchInterval = options.refetchInterval;

    if (!refetchInterval) {
      throw new Error('Expected refetch interval callback');
    }

    expect(
      refetchInterval({
        state: {
          data: {
            accounts: [],
            assets: [],
            balances: [],
            totalBalance: 42,
            isBalanceProviderUnavailable: false
          }
        }
      })
    ).toBe(false);
  });

  it('stops polling once the balance provider recovers', () => {
    expect(
      shouldRefetchWalletSummary({
        state: {
          data: {
            accounts: [],
            assets: [],
            balances: [],
            totalBalance: 42,
            isBalanceProviderUnavailable: false
          }
        }
      })
    ).toBe(false);
  });

  it('keeps reconciliation polling disabled when summary data is still missing', () => {
    expect(
      shouldRefetchWalletSummary({
        state: {
          data: undefined
        }
      })
    ).toBe(false);
  });

  it('transitions reconciliation polling from retrying to settled once data recovers', () => {
    const unavailableSummary = {
      accounts: [],
      assets: [],
      balances: [],
      totalBalance: 0,
      isBalanceProviderUnavailable: true
    };
    const recoveredSummary = {
      accounts: [],
      assets: [],
      balances: [],
      totalBalance: 12,
      isBalanceProviderUnavailable: false
    };

    const intervalDecisions = [
      shouldRefetchWalletSummary({
        state: {
          data: unavailableSummary
        }
      }),
      shouldRefetchWalletSummary({
        state: {
          data: unavailableSummary
        }
      }),
      shouldRefetchWalletSummary({
        state: {
          data: recoveredSummary
        }
      })
    ];

    expect(intervalDecisions).toEqual([10_000, 10_000, false]);
  });

  it('never enables automatic reconciliation polling in inventory-only mode', () => {
    const options = walletSummaryQueryOptions({
      currency: 'usd',
      isEnabled: true,
      mode: 'inventory-only',
      sessionId: 3,
      vault: {
        listAccounts: async () => [],
        listAssets: async () => [],
        getTotalBalances: async () => []
      }
    });

    expect(options.refetchInterval).toBe(false);
  });
});
