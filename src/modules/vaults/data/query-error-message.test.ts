import { describe, expect, it, vi } from 'vitest';

vi.mock('@project-eleven/libqc', () => {
  class CsprngUnavailableError extends Error {}
  class IncorrectPasswordError extends Error {}
  class KeyDerivationError extends Error {}
  class MissingChainError extends Error {}
  class NoPasswordSetError extends Error {}
  class VaultCorruptedError extends Error {}
  class VaultLockedError extends Error {}

  return {
    CsprngUnavailableError,
    IncorrectPasswordError,
    KeyDerivationError,
    MissingChainError,
    NoPasswordSetError,
    VaultCorruptedError,
    VaultLockedError
  };
});

import {
  MissingChainError,
  VaultCorruptedError,
  VaultLockedError
} from '@project-eleven/libqc';

import { toastMessages } from '@/lib/content';

import {
  queryErrorMessageKeyByCategory,
  resolveQueryErrorCategory,
  resolveQueryErrorMessage,
  type QueryErrorCategory
} from './query-error-message';

describe('resolveQueryErrorCategory', () => {
  it('maps vault locked typed errors to vault-state category', () => {
    expect(resolveQueryErrorCategory(new VaultLockedError())).toBe(
      'vaultState'
    );
  });

  it('maps vault corrupted typed errors to vault-state category', () => {
    expect(
      resolveQueryErrorCategory(new VaultCorruptedError('bad payload'))
    ).toBe('vaultState');
  });

  it('maps env misconfiguration typed errors to env category', () => {
    expect(resolveQueryErrorCategory(new MissingChainError())).toBe(
      'envMisconfigured'
    );
  });

  it('maps env missing-variable messages to env category', () => {
    expect(
      resolveQueryErrorCategory(
        new Error('Missing environment variable: VITE_ETHEREUM_RPC_URL')
      )
    ).toBe('envMisconfigured');
  });

  it('maps 429 status errors to rate-limit category', () => {
    expect(resolveQueryErrorCategory({ status: 429 })).toBe('rateLimited');
  });

  it('maps rate-limit message patterns to rate-limit category', () => {
    expect(
      resolveQueryErrorCategory(new Error('Request failed: too many requests'))
    ).toBe('rateLimited');
  });

  it('maps 503 status failures to rpc-unavailable category', () => {
    expect(
      resolveQueryErrorCategory({
        message: 'Service unavailable',
        statusCode: 503
      })
    ).toBe('rpcUnavailable');
  });

  it('does not classify generic json-rpc errors as rpc-unavailable', () => {
    expect(
      resolveQueryErrorCategory(new Error('JSON-RPC error: invalid params'))
    ).toBe('generic');
  });

  it('maps transport/network failure messages to network-connectivity category', () => {
    expect(resolveQueryErrorCategory(new Error('Failed to fetch'))).toBe(
      'networkConnectivity'
    );
  });

  it('maps transport/network failure codes to network-connectivity category', () => {
    expect(
      resolveQueryErrorCategory({
        code: 'ECONNREFUSED'
      })
    ).toBe('networkConnectivity');
  });

  it('inspects nested causes when classifying errors', () => {
    expect(
      resolveQueryErrorCategory({
        message: 'outer',
        cause: {
          status: 429
        }
      })
    ).toBe('rateLimited');
  });

  it('returns generic when error parsing throws', () => {
    const throwingError = {};
    Object.defineProperty(throwingError, 'message', {
      get: () => {
        throw new Error('message getter exploded');
      }
    });

    expect(resolveQueryErrorCategory(throwingError)).toBe('generic');
  });

  it('prefers rate-limit over rpc-unavailable when both match', () => {
    expect(
      resolveQueryErrorCategory({
        statusCode: 429,
        message: 'service unavailable'
      })
    ).toBe('rateLimited');
  });

  it('falls back to generic for unknown errors', () => {
    expect(
      resolveQueryErrorCategory(new Error('totally unknown failure'))
    ).toBe('generic');
  });
});

describe('resolveQueryErrorMessage', () => {
  it('maps every category to the configured toast message key', () => {
    const sampleErrorByCategory: Record<QueryErrorCategory, unknown> = {
      vaultState: new VaultLockedError(),
      envMisconfigured: new MissingChainError(),
      rateLimited: { status: 429 },
      rpcUnavailable: { status: 503 },
      networkConnectivity: { code: 'ECONNRESET' },
      generic: new Error('unknown')
    };

    for (const category of Object.keys(
      sampleErrorByCategory
    ) as Array<QueryErrorCategory>) {
      const messageKey = queryErrorMessageKeyByCategory[category];
      expect(resolveQueryErrorMessage(sampleErrorByCategory[category])).toBe(
        toastMessages[messageKey]
      );
    }
  });
});
