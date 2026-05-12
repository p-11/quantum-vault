import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WithdrawalRecord } from '@project-eleven/libqc';

import type { VaultSnapshot } from '@/modules/vaults/types';

import { HomeScreen } from './home-screen';

const useCurrencyMock = vi.hoisted(() => vi.fn());
const useScreenMock = vi.hoisted(() => vi.fn());
const useWalletMock = vi.hoisted(() => vi.fn());
const useVaultAccountSnapshotsQueryMock = vi.hoisted(() => vi.fn());
const useManualBalanceRefreshMock = vi.hoisted(() => vi.fn());

vi.mock('@project-eleven/libqc', () => ({}));

vi.mock('@/hooks/use-currency', () => ({
  useCurrency: useCurrencyMock
}));

vi.mock('@/hooks/use-screen', () => ({
  useScreen: useScreenMock
}));

vi.mock('@/hooks/use-wallet', () => ({
  useWallet: useWalletMock
}));

vi.mock('@/modules/vaults/data/hooks', () => ({
  useVaultAccountSnapshotsQuery: useVaultAccountSnapshotsQueryMock
}));

vi.mock('@/modules/vaults/shared/use-manual-balance-refresh', () => ({
  useManualBalanceRefresh: useManualBalanceRefreshMock
}));

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

const stripTags = (html: string): string => html.replace(/<[^>]*>/g, '');

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

const renderHome = () => renderToStaticMarkup(<HomeScreen />);

describe('HomeScreen', () => {
  beforeEach(() => {
    useCurrencyMock.mockReturnValue({ currency: 'usd' });
    useScreenMock.mockReturnValue({ navigate: vi.fn() });
    useManualBalanceRefreshMock.mockReturnValue({
      isRefreshingBalances: false,
      refreshBalancesManually: vi.fn()
    });
    useVaultAccountSnapshotsQueryMock.mockReturnValue(
      createVaultSnapshotsQuery()
    );
    useWalletMock.mockReturnValue({
      accounts: [],
      selectAccount: vi.fn(),
      sessionId: 1,
      vault: {
        getSupportedChains: () => [
          {
            chainId: { reference: '1' },
            iconUrl: 'eth.svg',
            name: 'Ethereum',
            nativeCurrency: { symbol: 'ETH' }
          }
        ]
      },
      withdrawSyncState: {
        status: 'idle',
        accountId: null,
        chainId: null
      },
      clearWithdrawSyncState: vi.fn(),
      latestWithdrawalRecordByAccountId: {}
    });
  });

  it('does not render the withdrawal sync banner while idle', () => {
    expect(renderHome()).not.toContain('home-withdraw-sync-banner');
  });

  it('renders a non-dismissable banner for visible syncing state', () => {
    useWalletMock.mockReturnValue({
      ...useWalletMock(),
      withdrawSyncState: {
        status: 'syncing',
        accountId: 'pending-account',
        chainId: 'eip155:1'
      }
    });

    const html = renderHome();

    expect(html).toContain('data-testid="home-withdraw-sync-banner"');
    expect(html).toContain('data-sync-status="syncing"');
    expect(stripTags(html)).toContain('Withdrawal syncing');
    expect(html).not.toContain('home-withdraw-sync-banner-dismiss-button');
  });

  it.each([
    { status: 'timeout', title: 'Sync delayed' },
    { status: 'failed', title: 'Withdrawal failed' }
  ] as const)(
    'renders a dismiss control for $status state',
    ({ status, title }) => {
      useWalletMock.mockReturnValue({
        ...useWalletMock(),
        withdrawSyncState: {
          status,
          accountId: 'pending-account',
          chainId: 'eip155:1'
        }
      });

      const html = renderHome();

      expect(html).toContain(`data-sync-status="${status}"`);
      expect(stripTags(html)).toContain(title);
      expect(html).toContain('home-withdraw-sync-banner-dismiss-button');
    }
  );

  it('renders Home totals and cards from lifecycle-aware balances', () => {
    const safeAccount = createAccount({ id: 'safe-account' });
    const pendingAccount = createAccount({ id: 'pending-account' });
    const sentAccount = createAccount({ id: 'sent-account' });
    const withdrawnAccount = createAccount({ id: 'withdrawn-account' });

    useWalletMock.mockReturnValue({
      ...useWalletMock(),
      accounts: [safeAccount, pendingAccount, sentAccount, withdrawnAccount],
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
    useVaultAccountSnapshotsQueryMock.mockReturnValue(
      createVaultSnapshotsQuery({
        data: {
          'safe-account': createSnapshot({ totalBalance: 12.5, tokenCount: 2 }),
          'pending-account': createSnapshot({
            totalBalance: 15.04,
            tokenCount: 1
          }),
          'sent-account': createSnapshot({ totalBalance: 7.5, tokenCount: 1 }),
          'withdrawn-account': createSnapshot({
            status: 'withdrawn',
            totalBalance: 2.25,
            tokenCount: 1
          })
        }
      })
    );

    const text = stripTags(renderHome());

    expect(text).toContain('TOTAL BALANCE$12.50');
    expect(text).toContain('WITHDRAWN · 3');
    expect(text.match(/\$0\.00/g)).toHaveLength(3);
    expect(text.match(/0 Tokens/g)).toHaveLength(3);
    expect(text).not.toContain('$15.04');
    expect(text).not.toContain('$7.50');
    expect(text).not.toContain('$2.25');
  });

  it('renders an unavailable total instead of under-reporting partial balances', () => {
    const safeAccount = createAccount({ id: 'safe-account' });
    const unavailableAccount = createAccount({ id: 'unavailable-account' });

    useWalletMock.mockReturnValue({
      ...useWalletMock(),
      accounts: [safeAccount, unavailableAccount]
    });
    useVaultAccountSnapshotsQueryMock.mockReturnValue(
      createVaultSnapshotsQuery({
        data: {
          'safe-account': createSnapshot({ totalBalance: 12.5, tokenCount: 2 }),
          'unavailable-account': createSnapshot({
            isUnavailable: true,
            totalBalance: null,
            tokenCount: null
          })
        }
      })
    );

    const text = stripTags(renderHome());

    expect(text).toContain('TOTAL BALANCE--');
    expect(text).not.toContain('TOTAL BALANCE$12.50');
  });

  it('renders an explicit error state when vault snapshots fail', () => {
    useVaultAccountSnapshotsQueryMock.mockReturnValue(
      createVaultSnapshotsQuery({ status: 'error' })
    );

    const text = stripTags(renderHome());

    expect(text).toContain('TOTAL BALANCE--');
    expect(text).toContain('Unable to load vault balances.');
  });
});
