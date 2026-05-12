import { beforeEach, describe, expect, it, vi } from 'vitest';

const useQueryMock = vi.hoisted(() => vi.fn());
const useWalletMock = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock
}));

vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();

  return {
    ...actual,
    useEffect: (effect: () => void) => {
      effect();
    },
    useRef: <T>(initialValue: T) => ({ current: initialValue })
  };
});

vi.mock('@/hooks/use-wallet', () => ({
  useWallet: useWalletMock
}));

vi.mock('@project-eleven/libqc', () => ({
  ActivityType: {
    NativeTransaction: 'NativeTransaction',
    Erc20Transaction: 'Erc20Transaction',
    BitcoinTransaction: 'BitcoinTransaction'
  }
}));

import {
  shouldHandleVaultDetailQueryError,
  shouldTriggerVaultDetailUnexpectedError,
  resolveVaultDetailQueryError,
  shouldLoadVaultActivities,
  useVaultDetailData,
  vaultActivitiesQueryFreshnessPolicy
} from './use-vault-detail-data';

beforeEach(() => {
  vi.clearAllMocks();
});

const lifecycleTimestamp = 1_710_000_000_000;
const lifecycleDestinationAddress =
  '0x1111111111111111111111111111111111111111';
const lifecycleTxRef =
  '0x95d0c0a9f7eb489ccb6d2e2d8af17a58fa2df04af745cc34eddf566f5f04789a';

describe('shouldLoadVaultActivities', () => {
  it('returns false without a selected account', () => {
    expect(
      shouldLoadVaultActivities({
        activeTabId: 'activity',
        hasSelectedAccount: false,
        hasVaultDetailData: true,
        lifecycleStatus: { kind: 'safe' }
      })
    ).toBe(false);
  });

  it('returns false before vault detail data is available', () => {
    expect(
      shouldLoadVaultActivities({
        activeTabId: 'activity',
        hasSelectedAccount: true,
        hasVaultDetailData: false,
        lifecycleStatus: { kind: 'safe' }
      })
    ).toBe(false);
  });

  it('loads activities when the activity tab is active', () => {
    expect(
      shouldLoadVaultActivities({
        activeTabId: 'activity',
        hasSelectedAccount: true,
        hasVaultDetailData: true,
        lifecycleStatus: { kind: 'safe' }
      })
    ).toBe(true);
  });

  it('loads activities on funds tab when lifecycle tx metadata needs an activity fallback', () => {
    expect(
      shouldLoadVaultActivities({
        activeTabId: 'funds',
        hasSelectedAccount: true,
        hasVaultDetailData: true,
        lifecycleStatus: {
          kind: 'pending',
          initiatedAt: lifecycleTimestamp,
          destinationAddress: lifecycleDestinationAddress,
          txRefs: []
        }
      })
    ).toBe(true);
    expect(
      shouldLoadVaultActivities({
        activeTabId: 'funds',
        hasSelectedAccount: true,
        hasVaultDetailData: true,
        lifecycleStatus: {
          kind: 'withdrawn',
          completedAt: null,
          destinationAddress: null,
          txRefs: []
        }
      })
    ).toBe(false);
    expect(
      shouldLoadVaultActivities({
        activeTabId: 'funds',
        hasSelectedAccount: true,
        hasVaultDetailData: true,
        lifecycleStatus: {
          kind: 'sent',
          confirmedAt: lifecycleTimestamp,
          destinationAddress: lifecycleDestinationAddress,
          txRefs: [lifecycleTxRef]
        }
      })
    ).toBe(false);
    expect(
      shouldLoadVaultActivities({
        activeTabId: 'funds',
        hasSelectedAccount: true,
        hasVaultDetailData: true,
        lifecycleStatus: {
          kind: 'withdrawn',
          completedAt: lifecycleTimestamp,
          destinationAddress: lifecycleDestinationAddress,
          txRefs: []
        }
      })
    ).toBe(true);
    expect(
      shouldLoadVaultActivities({
        activeTabId: 'funds',
        hasSelectedAccount: true,
        hasVaultDetailData: true,
        lifecycleStatus: { kind: 'safe' }
      })
    ).toBe(false);
  });
});

describe('vaultActivitiesQueryFreshnessPolicy', () => {
  it('treats account activity as externally mutable data', () => {
    expect(vaultActivitiesQueryFreshnessPolicy).toEqual({
      staleTime: 0,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      refetchOnReconnect: true
    });
  });

  it('applies the policy to the account activities query', () => {
    const selectedAccount = {
      id: { toString: () => 'account-1' },
      address: '0x1111111111111111111111111111111111111111'
    };
    const vaultDetailQueryData = {
      assets: [],
      balances: [],
      vaultState: 'safe',
      totalCurrencyValue: 0
    };
    useWalletMock.mockReturnValue({
      latestWithdrawalRecordByAccountId: {}
    });
    useQueryMock
      .mockReturnValueOnce({
        data: vaultDetailQueryData,
        isError: false,
        error: null
      })
      .mockReturnValueOnce({
        data: [],
        isError: false,
        error: null
      });

    const result = useVaultDetailData({
      activeTabId: 'activity',
      currency: 'usd',
      onUnexpectedError: vi.fn(),
      selectedAccount,
      sessionId: 1,
      vault: {
        getAccount: vi.fn(),
        getSupportedChains: vi.fn()
      }
    });

    expect(useQueryMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining(vaultActivitiesQueryFreshnessPolicy)
    );
    expect(result.isActivityLoading).toBe(false);
  });

  it('marks the activity panel as loading while a freshly enabled activity query has no data', () => {
    const selectedAccount = {
      id: { toString: () => 'account-1' },
      address: '0x1111111111111111111111111111111111111111'
    };
    const vaultDetailQueryData = {
      assets: [],
      balances: [],
      vaultState: 'safe',
      totalCurrencyValue: 0
    };
    useWalletMock.mockReturnValue({
      latestWithdrawalRecordByAccountId: {}
    });
    useQueryMock
      .mockReturnValueOnce({
        data: vaultDetailQueryData,
        isError: false,
        error: null
      })
      .mockReturnValueOnce({
        data: undefined,
        isError: false,
        error: null
      });

    const result = useVaultDetailData({
      activeTabId: 'activity',
      currency: 'usd',
      onUnexpectedError: vi.fn(),
      selectedAccount,
      sessionId: 1,
      vault: {
        getAccount: vi.fn(),
        getSupportedChains: vi.fn()
      }
    });

    expect(result.vaultData?.activities).toEqual([]);
    expect(result.isActivityLoading).toBe(true);
  });

  it('keeps cached activity rows on screen when a background activity refetch fails', () => {
    const selectedAccount = {
      id: { toString: () => 'account-1' },
      address: '0x1111111111111111111111111111111111111111'
    };
    const vaultDetailQueryData = {
      assets: [],
      balances: [],
      vaultState: 'safe',
      totalCurrencyValue: 0
    };
    const onUnexpectedError = vi.fn();
    useWalletMock.mockReturnValue({
      latestWithdrawalRecordByAccountId: {}
    });
    useQueryMock
      .mockReturnValueOnce({
        data: vaultDetailQueryData,
        isError: false,
        error: null
      })
      .mockReturnValueOnce({
        data: [
          {
            id: 'activity-1',
            direction: 'inbound',
            counterparty: '0x2222222222222222222222222222222222222222',
            amount: 1n,
            symbol: 'ETH',
            decimals: 18,
            timestamp: null,
            txRef: '0xtx',
            blockNumber: 1n
          }
        ],
        isError: true,
        error: new Error('activity refetch failed')
      });

    const result = useVaultDetailData({
      activeTabId: 'activity',
      currency: 'usd',
      onUnexpectedError,
      selectedAccount,
      sessionId: 1,
      vault: {
        getAccount: vi.fn(),
        getSupportedChains: vi.fn()
      }
    });

    expect(result.isActivityLoading).toBe(false);
    expect(result.vaultData?.activities).toHaveLength(1);
    expect(onUnexpectedError).not.toHaveBeenCalled();
  });

  it('derives recordless exposed empty vault detail data as withdrawn after recovery', () => {
    const selectedAccount = {
      id: { toString: () => 'account-1' },
      address: '0x1111111111111111111111111111111111111111'
    };
    const vaultDetailQueryData = {
      assets: [],
      balances: [],
      hasNonInterfaceAssetBalance: false,
      vaultState: 'vulnerable',
      totalCurrencyValue: 0
    };
    useWalletMock.mockReturnValue({
      latestWithdrawalRecordByAccountId: {}
    });
    useQueryMock
      .mockReturnValueOnce({
        data: vaultDetailQueryData,
        isError: false,
        error: null
      })
      .mockReturnValueOnce({
        data: [],
        isError: false,
        error: null
      });

    const result = useVaultDetailData({
      activeTabId: 'funds',
      currency: 'usd',
      onUnexpectedError: vi.fn(),
      selectedAccount,
      sessionId: 1,
      vault: {
        getAccount: vi.fn(),
        getSupportedChains: vi.fn()
      }
    });

    expect(result.vaultState).toBe('withdrawn');
    expect(result.lifecycleKind).toBe('withdrawn');
    expect(result.lifecycleStatus).toEqual({
      kind: 'withdrawn',
      completedAt: null,
      destinationAddress: null,
      txRefs: []
    });
    expect(useQueryMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ enabled: false })
    );
  });
});

describe('shouldHandleVaultDetailQueryError', () => {
  it('handles vault detail query errors', () => {
    expect(
      shouldHandleVaultDetailQueryError({
        activitiesQueryIsError: false,
        shouldLoadActivities: false,
        vaultDetailQueryIsError: true
      })
    ).toBe(true);
  });

  it('handles activity fallback errors when activities were loaded for funds tab metadata fallback', () => {
    expect(
      shouldHandleVaultDetailQueryError({
        activitiesQueryIsError: true,
        shouldLoadActivities: true,
        vaultDetailQueryIsError: false
      })
    ).toBe(true);
  });

  it('ignores disabled activity query errors', () => {
    expect(
      shouldHandleVaultDetailQueryError({
        activitiesQueryIsError: true,
        shouldLoadActivities: false,
        vaultDetailQueryIsError: false
      })
    ).toBe(false);
  });
});

describe('shouldTriggerVaultDetailUnexpectedError', () => {
  it('does not trigger when the error was already handled for the current session/account', () => {
    expect(
      shouldTriggerVaultDetailUnexpectedError({
        activitiesQueryIsError: true,
        hasHandledError: true,
        shouldLoadActivities: true,
        vaultDetailQueryIsError: true
      })
    ).toBe(false);
  });

  it('triggers once when a fresh vault detail error arrives', () => {
    expect(
      shouldTriggerVaultDetailUnexpectedError({
        activitiesQueryIsError: false,
        hasHandledError: false,
        shouldLoadActivities: false,
        vaultDetailQueryIsError: true
      })
    ).toBe(true);
  });

  it('ignores stale activity-query errors when activity loading is disabled', () => {
    expect(
      shouldTriggerVaultDetailUnexpectedError({
        activitiesQueryIsError: true,
        hasHandledError: false,
        shouldLoadActivities: false,
        vaultDetailQueryIsError: false
      })
    ).toBe(false);
  });
});

describe('resolveVaultDetailQueryError', () => {
  it('prefers vault detail query error when both queries fail', () => {
    const vaultDetailError = new Error('detail failed');
    const activitiesError = new Error('activities failed');

    expect(
      resolveVaultDetailQueryError({
        vaultDetailIsError: true,
        vaultDetailError,
        activitiesIsError: true,
        activitiesError
      })
    ).toBe(vaultDetailError);
  });

  it('returns activities error when only activities query fails', () => {
    const activitiesError = new Error('activities failed');

    expect(
      resolveVaultDetailQueryError({
        vaultDetailIsError: false,
        vaultDetailError: null,
        activitiesIsError: true,
        activitiesError
      })
    ).toBe(activitiesError);
  });

  it('returns undefined when no query is in error state', () => {
    expect(
      resolveVaultDetailQueryError({
        vaultDetailIsError: false,
        vaultDetailError: null,
        activitiesIsError: false,
        activitiesError: null
      })
    ).toBeUndefined();
  });
});
