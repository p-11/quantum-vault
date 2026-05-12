import {
  IncorrectPasswordError,
  VaultLockedError
} from '@project-eleven/libqc';
import { describe, expect, it, vi } from 'vitest';

import { toastMessages } from '@/lib/content';

vi.mock('@project-eleven/libqc', () => {
  class IncorrectPasswordError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'IncorrectPasswordError';
    }
  }
  class VaultLockedError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'VaultLockedError';
    }
  }

  return {
    IncorrectPasswordError,
    VaultLockedError
  };
});

import { resolveExportRecoveryPhraseError } from './export-recovery-phrase-errors';

describe('resolveExportRecoveryPhraseError', () => {
  it('classifies invalid password errors', () => {
    expect(
      resolveExportRecoveryPhraseError(
        new IncorrectPasswordError('Incorrect password')
      )
    ).toEqual({
      status: 'failed',
      reason: 'invalid-password',
      message: toastMessages.invalidPassword
    });
    expect(
      resolveExportRecoveryPhraseError(new Error('Incorrect password'))
    ).toEqual({
      status: 'failed',
      reason: 'invalid-password',
      message: toastMessages.invalidPassword
    });
  });

  it('classifies locked vault errors', () => {
    expect(
      resolveExportRecoveryPhraseError(
        new VaultLockedError(
          'Vault is locked. Call unlock() with the correct password first.'
        )
      )
    ).toEqual({
      status: 'failed',
      reason: 'locked',
      message: toastMessages.vaultQueryVaultStateFailed
    });
    expect(
      resolveExportRecoveryPhraseError(
        new Error(
          'Vault is locked. Call unlock() with the correct password first.'
        )
      )
    ).toEqual({
      status: 'failed',
      reason: 'locked',
      message: toastMessages.vaultQueryVaultStateFailed
    });
  });

  it('preserves libqc missing recovery phrase storage errors', () => {
    expect(
      resolveExportRecoveryPhraseError(new Error('Seed not found in storage'))
    ).toEqual({
      status: 'failed',
      reason: 'error',
      message: 'Export failed: Seed not found in storage'
    });
  });

  it('falls back to a generic error for unknown failures', () => {
    expect(
      resolveExportRecoveryPhraseError(new Error('network unavailable'))
    ).toEqual({
      status: 'failed',
      reason: 'error',
      message: 'Export failed: network unavailable'
    });
  });
});
