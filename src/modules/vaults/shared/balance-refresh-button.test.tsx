import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@project-eleven/libqc', () => ({
  formatUnits: () => '1',
  isNativeAsset: () => true
}));

import { BalanceRefreshButton } from './balance-refresh-button';

describe('BalanceRefreshButton', () => {
  it('renders an accessible manual refresh button', () => {
    const html = renderToStaticMarkup(
      <BalanceRefreshButton
        ariaLabel='Refresh balances'
        isRefreshing={false}
        testId='refresh-balances-button'
        onClick={() => undefined}
      />
    );

    expect(html).toContain('aria-label="Refresh balances"');
    expect(html).toContain('data-testid="refresh-balances-button"');
    expect(html).toContain('data-refreshing="false"');
    expect(html).toContain('size-6');
    expect(html).toContain('stroke-width="1"');
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain('animate-spin');
  });

  it('disables and spins while refresh is running', () => {
    const html = renderToStaticMarkup(
      <BalanceRefreshButton
        ariaLabel='Refresh balances'
        isRefreshing
        testId='refresh-balances-button'
        onClick={() => undefined}
      />
    );

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('data-refreshing="true"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('animate-spin');
  });
});
