import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@project-eleven/libqc', () => ({
  ActivityType: {
    NativeTransaction: 'NativeTransaction',
    Erc20Transaction: 'Erc20Transaction',
    BitcoinTransaction: 'BitcoinTransaction'
  },
  formatUnits: () => '1'
}));

import { vaultDetailCopy } from '@/lib/copy';
import type { VaultStatus } from '@/modules/vaults/core';
import type { VaultLifecycleStatus } from '@/modules/vaults/lifecycle/types';

import { VaultDetailActivityPanel } from './panels';
import type { VaultData } from './types';

const withdrawAllRowLabel = vaultDetailCopy.activityDirectionWithdrawAll;

const safeLifecycleStatus: VaultLifecycleStatus = { kind: 'safe' };

const recordlessWithdrawnLifecycleStatus: VaultLifecycleStatus = {
  kind: 'withdrawn',
  completedAt: null,
  destinationAddress: null,
  txRefs: []
};

const createVaultData = ({
  symbol = 'BTC',
  txRef
}: {
  symbol?: string;
  txRef: string | null;
}): VaultData => ({
  assets: [],
  balances: [],
  onChainVaultStatus: 'vulnerable',
  totalCurrencyValue: 20.03,
  activities: [
    {
      id: 'activity-1',
      direction: 'outbound',
      counterparty: 'bc1q8d1234567890',
      amount: 1n,
      symbol,
      decimals: 8,
      timestamp: null,
      txRef,
      blockNumber: null
    }
  ]
});

const renderActivityPanelHtml = ({
  vaultData,
  vaultState,
  lifecycleStatus = safeLifecycleStatus
}: {
  vaultData: VaultData;
  vaultState: VaultStatus;
  lifecycleStatus?: VaultLifecycleStatus;
}): string =>
  renderToStaticMarkup(
    <VaultDetailActivityPanel
      vaultData={vaultData}
      isActivityLoading={false}
      vaultState={vaultState}
      lifecycleStatus={lifecycleStatus}
    />
  );

describe('VaultDetailActivityPanel', () => {
  it('renders BTC activity rows with valid tx refs as mempool explorer links', () => {
    const txRef =
      '95d0c0a9f7eb489ccb6d2e2d8af17a58fa2df04af745cc34eddf566f5f04789a';
    const html = renderActivityPanelHtml({
      vaultData: createVaultData({ txRef }),
      vaultState: 'vulnerable'
    });

    expect(html).toContain('<a');
    expect(html).toContain(`href="https://mempool.space/tx/${txRef}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain(
      'aria-label="View BTC transaction on mempool.space"'
    );
    expect(html).toContain('data-has-tx-url="true"');
    expect(html).toContain(`data-tx-ref="${txRef}"`);
  });

  it('renders ETH activity rows with valid tx refs as Etherscan explorer links', () => {
    const txRef =
      '0x95d0c0a9f7eb489ccb6d2e2d8af17a58fa2df04af745cc34eddf566f5f04789a';
    const html = renderActivityPanelHtml({
      vaultData: createVaultData({ symbol: 'ETH', txRef }),
      vaultState: 'vulnerable'
    });

    expect(html).toContain('<a');
    expect(html).toContain(`href="https://etherscan.io/tx/${txRef}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('aria-label="View ETH transaction on Etherscan"');
    expect(html).toContain('data-has-tx-url="true"');
    expect(html).toContain(`data-tx-ref="${txRef}"`);
  });

  it('renders activity rows without tx refs as static content', () => {
    const html = renderActivityPanelHtml({
      vaultData: createVaultData({ txRef: null }),
      vaultState: 'vulnerable'
    });

    expect(html).toContain('<div');
    expect(html).not.toContain('<a');
    expect(html).toContain('data-has-tx-url="false"');
  });

  it('does not flag the latest outbound activity as withdraw-all when withdrawn lifecycle is recordless', () => {
    const txRef =
      '0x95d0c0a9f7eb489ccb6d2e2d8af17a58fa2df04af745cc34eddf566f5f04789a';
    const html = renderActivityPanelHtml({
      vaultData: createVaultData({ symbol: 'ETH', txRef }),
      vaultState: 'withdrawn',
      lifecycleStatus: recordlessWithdrawnLifecycleStatus
    });

    // recordless withdrawn = recovered exposed-empty wallet; the latest
    // outbound is plausibly an attacker drain. It must not be marked as the
    // user's "Withdraw ALL" success row.
    expect(html).not.toContain(withdrawAllRowLabel);
  });

  it('flags the latest outbound activity as withdraw-all when withdrawn lifecycle is record-backed', () => {
    const txRef =
      '0x95d0c0a9f7eb489ccb6d2e2d8af17a58fa2df04af745cc34eddf566f5f04789a';
    const recordBackedWithdrawnLifecycleStatus: VaultLifecycleStatus = {
      kind: 'withdrawn',
      completedAt: 1_710_000_000_000,
      destinationAddress: '0x1111111111111111111111111111111111111111',
      txRefs: [txRef]
    };
    const html = renderActivityPanelHtml({
      vaultData: createVaultData({ symbol: 'ETH', txRef }),
      vaultState: 'withdrawn',
      lifecycleStatus: recordBackedWithdrawnLifecycleStatus
    });

    expect(html).toContain(withdrawAllRowLabel);
  });
});
