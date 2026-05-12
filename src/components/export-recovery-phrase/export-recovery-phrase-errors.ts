import {
  IncorrectPasswordError,
  VaultLockedError
} from '@project-eleven/libqc';

import { toastMessages } from '@/lib/content';

export type SubmitPasswordErrorResult = {
  status: 'failed';
  reason: 'invalid-password' | 'locked' | 'error';
  message: string;
};

const isErrorLike = (error: unknown): error is Error => error instanceof Error;

const matchesErrorIdentity = ({
  error,
  name,
  message
}: {
  error: unknown;
  name: string;
  message: string;
}): boolean =>
  isErrorLike(error) &&
  (error.name === name ||
    error.constructor.name === name ||
    error.message === message);

const isInvalidPasswordError = (error: unknown): boolean =>
  error instanceof IncorrectPasswordError ||
  matchesErrorIdentity({
    error,
    name: 'IncorrectPasswordError',
    message: 'Incorrect password'
  });

const isLockedVaultError = (error: unknown): boolean =>
  error instanceof VaultLockedError ||
  matchesErrorIdentity({
    error,
    name: 'VaultLockedError',
    message: 'Vault is locked. Call unlock() with the correct password first.'
  });

const formatExportRecoveryPhraseErrorMessage = (error: unknown): string => {
  if (!isErrorLike(error)) {
    return 'Export failed';
  }

  const constructorName = error.constructor.name;
  const instanceName = error.name && error.name !== 'Error' ? error.name : '';
  const errorName =
    instanceName.length > 0
      ? instanceName
      : constructorName.length > 0 && constructorName !== 'Error'
        ? constructorName
        : '';
  const errorMessage = error.message.trim();

  if (errorName && errorName !== 'Error' && errorMessage.length > 0) {
    return `Export failed: ${errorName}: ${errorMessage}`;
  }

  if (errorMessage.length > 0) {
    return `Export failed: ${errorMessage}`;
  }

  return 'Export failed';
};

export const resolveExportRecoveryPhraseError = (
  error: unknown
): SubmitPasswordErrorResult => {
  if (isInvalidPasswordError(error)) {
    return {
      status: 'failed',
      reason: 'invalid-password',
      message: toastMessages.invalidPassword
    };
  }

  if (isLockedVaultError(error)) {
    return {
      status: 'failed',
      reason: 'locked',
      message: toastMessages.vaultQueryVaultStateFailed
    };
  }

  return {
    status: 'failed',
    reason: 'error',
    message: formatExportRecoveryPhraseErrorMessage(error)
  };
};
