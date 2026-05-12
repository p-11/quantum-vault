import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { VaultSnapshot } from '@/modules/vaults/types';

import { ReceiveScreen } from './receive-screen';

const useCurrencyMock = vi.hoisted(() => vi.fn());
const useScreenMock = vi.hoisted(() => vi.fn());
const useWalletMock = vi.hoisted(() => vi.fn());
const useVaultLifecycleAccountsMock = vi.hoisted(() => vi.fn());

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

vi.mock('@/modules/vaults/lifecycle/use-vault-lifecycle-accounts', () => ({
  useVaultLifecycleAccounts: useVaultLifecycleAccountsMock
}));

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

const renderReceive = () => renderToStaticMarkup(<ReceiveScreen />);

describe('ReceiveScreen', () => {
  beforeEach(() => {
    useCurrencyMock.mockReturnValue({ currency: 'usd' });
    useScreenMock.mockReturnValue({
      navigate: vi.fn(),
      previousScreen: 'home'
    });
    useWalletMock.mockReturnValue({
      accounts: [],
      latestWithdrawalRecordByAccountId: {},
      refreshBalances: vi.fn(),
      selectedAccount: undefined,
      sessionId: 1,
      vault: {
        getSupportedChains: () => []
      }
    });
    useVaultLifecycleAccountsMock.mockReturnValue({
      vaultSnapshotsQuery: createVaultSnapshotsQuery(),
      depositEligibleAccounts: [],
      getDepositEligibleAccountsByChainId: vi.fn(() => [])
    });
  });

  it('renders an explicit error when safe vault snapshots fail', () => {
    useVaultLifecycleAccountsMock.mockReturnValue({
      vaultSnapshotsQuery: createVaultSnapshotsQuery({ status: 'error' }),
      depositEligibleAccounts: [],
      getDepositEligibleAccountsByChainId: vi.fn(() => [])
    });

    const html = renderReceive();

    expect(html).toContain('data-testid="receive-safe-vaults-error"');
    expect(html).toContain('Unable to load safe vaults.');
  });
});
