import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VaultDetailScreen } from './vault-detail-screen';

const useCurrencyMock = vi.hoisted(() => vi.fn());
const useScreenMock = vi.hoisted(() => vi.fn());
const useWalletMock = vi.hoisted(() => vi.fn());
const useVaultDetailDataMock = vi.hoisted(() => vi.fn());
const useManualBalanceRefreshMock = vi.hoisted(() => vi.fn());

vi.mock('@project-eleven/libqc', () => ({
  ActivityType: {
    BitcoinTransaction: 'BitcoinTransaction',
    Erc20Transaction: 'Erc20Transaction',
    NativeTransaction: 'NativeTransaction'
  },
  formatUnits: vi.fn()
}));

vi.mock('@/hooks/use-currency', () => ({
  useCurrency: useCurrencyMock
}));

vi.mock('@/hooks/use-screen', () => ({
  useScreen: useScreenMock
}));

vi.mock('@/hooks/use-wallet', () => ({
  useWallet: useWalletMock
}));

vi.mock('@/modules/vaults/detail/use-vault-detail-data', () => ({
  useVaultDetailData: useVaultDetailDataMock
}));

vi.mock('@/modules/vaults/shared/use-manual-balance-refresh', () => ({
  useManualBalanceRefresh: useManualBalanceRefreshMock
}));

const createAccount = () => ({
  id: {
    toString: () => 'account-1'
  },
  address: '0x1111111111111111111111111111111111111111',
  chainId: {
    namespace: 'eip155',
    reference: '1',
    toString: () => 'eip155:1'
  }
});

const createVaultDetailQuery = (status: 'pending' | 'error' | 'success') => ({
  data: undefined,
  error: status === 'error' ? new Error('vault detail failed') : null,
  isError: status === 'error',
  isPending: status === 'pending',
  status
});

const renderVaultDetail = () => renderToStaticMarkup(<VaultDetailScreen />);

describe('VaultDetailScreen', () => {
  beforeEach(() => {
    const account = createAccount();
    useCurrencyMock.mockReturnValue({ currency: 'usd' });
    useScreenMock.mockReturnValue({ navigate: vi.fn() });
    useManualBalanceRefreshMock.mockReturnValue({
      isRefreshingBalances: false,
      refreshBalancesManually: vi.fn()
    });
    useWalletMock.mockReturnValue({
      accounts: [account],
      clearWalletState: vi.fn(),
      selectedAccount: account,
      sessionId: 1,
      vault: {
        getSupportedChains: () => [
          {
            chainId: account.chainId,
            iconUrl: 'eth.svg',
            name: 'Ethereum',
            nativeCurrency: { symbol: 'ETH' }
          }
        ]
      }
    });
    useVaultDetailDataMock.mockReturnValue({
      vaultData: undefined,
      vaultDetailQuery: createVaultDetailQuery('pending'),
      isActivityLoading: false,
      vaultState: 'safe',
      lifecycleKind: 'safe',
      lifecycleStatus: { kind: 'safe' }
    });
  });

  it('renders an explicit error when vault detail data fails to load', () => {
    useVaultDetailDataMock.mockReturnValue({
      vaultData: undefined,
      vaultDetailQuery: createVaultDetailQuery('error'),
      isActivityLoading: false,
      vaultState: 'safe',
      lifecycleKind: 'safe',
      lifecycleStatus: { kind: 'safe' }
    });

    const html = renderVaultDetail();

    expect(html).toContain('Unable to load vault details.');
    expect(html).toContain('TOTAL BALANCE</p><p class="type-value-xl mt-1');
    expect(html).toContain('--');
  });
});
