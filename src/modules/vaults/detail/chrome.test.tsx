import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@project-eleven/libqc', () => ({
  ActivityType: {
    NativeTransaction: 'NativeTransaction',
    Erc20Transaction: 'Erc20Transaction',
    BitcoinTransaction: 'BitcoinTransaction'
  }
}));

vi.mock('@/modules/vaults/shared/use-manual-balance-refresh', () => ({
  useManualBalanceRefresh: () => ({
    isRefreshingBalances: false,
    refreshBalancesManually: () => undefined
  })
}));

import { VaultDetailBalanceSection, VaultDetailHeader } from './chrome';
import { shouldHideVaultDetailActions } from './action-visibility';

const getTextContentFromMarkup = (markup: string): string =>
  markup.replace(/<[^>]*>/g, '');

describe('shouldHideVaultDetailActions', () => {
  it('hides actions while withdrawal is pending', () => {
    expect(
      shouldHideVaultDetailActions({
        lifecycleKind: 'pending'
      })
    ).toBe(true);
  });

  it('keeps actions visible for terminal withdrawn lifecycle states', () => {
    expect(
      shouldHideVaultDetailActions({
        lifecycleKind: 'withdrawn'
      })
    ).toBe(false);
    expect(
      shouldHideVaultDetailActions({
        lifecycleKind: 'sent'
      })
    ).toBe(false);
    expect(
      shouldHideVaultDetailActions({
        lifecycleKind: 'safe'
      })
    ).toBe(false);
    expect(
      shouldHideVaultDetailActions({
        lifecycleKind: 'vulnerable'
      })
    ).toBe(false);
  });
});

describe('VaultDetailBalanceSection', () => {
  it('renders stable vulnerable withdraw copy without tab-dependent state', () => {
    const html = renderToStaticMarkup(
      <VaultDetailBalanceSection
        vaultData={{
          assets: [],
          balances: [],
          activities: [],
          onChainVaultStatus: 'vulnerable',
          totalCurrencyValue: 20.03
        }}
        vaultState='vulnerable'
        lifecycleKind='vulnerable'
        currency='usd'
        withdrawAvailability={{ kind: 'enabled' }}
        onDeposit={() => undefined}
        onWithdraw={() => undefined}
      />
    );

    expect(html).toContain('vault-detail-withdraw-button');
    expect(html).toContain('Withdraw');
    expect(html).not.toContain('Withdraw to Safe Vault');
  });

  it('keeps ordinary withdraw copy for safe vault secondary actions', () => {
    const html = renderToStaticMarkup(
      <VaultDetailBalanceSection
        vaultData={{
          assets: [],
          balances: [],
          activities: [],
          onChainVaultStatus: 'safe',
          totalCurrencyValue: 20.03
        }}
        vaultState='safe'
        lifecycleKind='safe'
        currency='usd'
        withdrawAvailability={{ kind: 'enabled' }}
        onDeposit={() => undefined}
        onWithdraw={() => undefined}
      />
    );

    expect(html).toContain('Withdraw');
    expect(html).not.toContain('Withdraw to Safe Vault');
  });

  it('renders the live snapshot total for non-withdrawal lifecycles', () => {
    const html = renderToStaticMarkup(
      <VaultDetailBalanceSection
        vaultData={{
          assets: [],
          balances: [],
          activities: [],
          onChainVaultStatus: 'safe',
          totalCurrencyValue: 20.03
        }}
        vaultState='safe'
        lifecycleKind='safe'
        currency='usd'
        withdrawAvailability={{ kind: 'enabled' }}
        onDeposit={() => undefined}
        onWithdraw={() => undefined}
      />
    );

    expect(getTextContentFromMarkup(html)).toContain('$20.03');
  });

  it.each(['pending', 'sent', 'withdrawn'] as const)(
    'collapses the total to zero once the lifecycle is %s, even with a stale snapshot',
    lifecycleKind => {
      const html = renderToStaticMarkup(
        <VaultDetailBalanceSection
          vaultData={{
            assets: [],
            balances: [],
            activities: [],
            onChainVaultStatus: 'withdrawn',
            totalCurrencyValue: 15.04
          }}
          vaultState='withdrawn'
          lifecycleKind={lifecycleKind}
          currency='usd'
          withdrawAvailability={{ kind: 'hidden' }}
          onDeposit={() => undefined}
          onWithdraw={() => undefined}
        />
      );

      expect(getTextContentFromMarkup(html)).toContain('$0.00');
      expect(getTextContentFromMarkup(html)).not.toContain('$15.04');
    }
  );

  it('renders a skeleton when vaultData is undefined', () => {
    const html = renderToStaticMarkup(
      <VaultDetailBalanceSection
        vaultData={undefined}
        vaultState='safe'
        lifecycleKind='safe'
        currency='usd'
        withdrawAvailability={{ kind: 'hidden' }}
        onDeposit={() => undefined}
        onWithdraw={() => undefined}
      />
    );

    // CurrencyValueText would emit a `$` glyph; the skeleton fallback does
    // not. This pins down the loading branch without coupling to the exact
    // Skeleton class names.
    expect(html).not.toContain('$');
    expect(html).toContain('animate-pulse');
  });
});

describe('VaultDetailHeader', () => {
  it('renders a manual refresh action for the selected vault', () => {
    const html = renderToStaticMarkup(
      <VaultDetailHeader
        selectedAddress='0x1234567890abcdef'
        title='ETH Vault #1'
        vaultState='safe'
        onBack={() => undefined}
      />
    );

    expect(html).toContain(
      'data-testid="vault-detail-refresh-balances-button"'
    );
    expect(html).toContain('aria-label="Refresh balances"');
  });
});
