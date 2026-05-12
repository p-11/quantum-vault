import {
  depositFlowCopy,
  formatVaultNumberForDisplay,
  getAlertTitle,
  getHomeAlertLine,
  getVaultName,
  vaultDetailCopy,
  withdrawFlowCopy
} from '@/lib/copy';

describe('getAlertTitle', () => {
  it('formats singular vulnerable vault title', () => {
    expect(getAlertTitle(1)).toBe('1 Vault Vulnerable');
  });

  it('formats plural vulnerable vault title', () => {
    expect(getAlertTitle(2)).toBe('2 Vaults Vulnerable');
  });
});

describe('getHomeAlertLine', () => {
  it('formats alert line with figma punctuation and suffix', () => {
    expect(
      getHomeAlertLine({
        vaultLabel: 'Ethereum Vault #01',
        amount: '$40,530.12'
      })
    ).toBe('Ethereum Vault #01 - $40,530.12 at risk');
  });
});

describe('formatVaultNumberForDisplay', () => {
  it('zero-pads single-digit vault numbers', () => {
    expect(formatVaultNumberForDisplay(1)).toBe('01');
    expect(formatVaultNumberForDisplay(9)).toBe('09');
  });

  it('leaves multi-digit numbers unchanged', () => {
    expect(formatVaultNumberForDisplay(10)).toBe('10');
    expect(formatVaultNumberForDisplay(99)).toBe('99');
  });
});

describe('getVaultName', () => {
  it('formats vault label with zero-padded vault number', () => {
    expect(getVaultName({ chainName: 'Bitcoin', vaultNumber: 3 })).toBe(
      'Bitcoin Vault #03'
    );
  });
});

describe('vaultDetailCopy', () => {
  it('uses figma-aligned vulnerable activity CTA copy', () => {
    expect(vaultDetailCopy.withdrawToSafeAction).toBe('Withdraw');
  });
});

describe('depositFlowCopy', () => {
  it('uses a single-asset warning when chain symbol matches token family', () => {
    expect(depositFlowCopy.warningSubtitle('BTC', 'BTC')).toBe(
      'Only send BTC to this address'
    );
    expect(depositFlowCopy.warningSubtitle('ETH', 'ETH')).toBe(
      'Only send ETH to this address'
    );
  });

  it('uses slash form when chain symbol differs from token family', () => {
    expect(depositFlowCopy.warningSubtitle('ETH', 'USDC')).toBe(
      'Only send ETH / USDC to this address'
    );
  });
});

describe('withdrawFlowCopy', () => {
  it('surfaces full-balance withdrawal helper copy (ENG-1817)', () => {
    expect(withdrawFlowCopy.fullBalanceWithdrawHelper).toBe(
      'A withdrawal will send your full vault balance. Partial withdrawals are not supported in the current version.'
    );
  });

  it('uses Withdraw Vault as the manual destination screen title', () => {
    expect(withdrawFlowCopy.addAddressTitle).toBe('Withdraw Vault');
  });

  it('keeps distinct confirm labels for suggested and manual paths', () => {
    expect(withdrawFlowCopy.confirmAction).toBe('CONFIRM');
    expect(withdrawFlowCopy.confirmWithdrawalAction).toBe('CONFIRM WITHDRAWAL');
  });

  it('keeps figma-aligned suggestion decline CTA', () => {
    expect(withdrawFlowCopy.suggestionNo).toBe(
      'NO, WITHDRAW TO EXTERNAL WALLET'
    );
  });
});
