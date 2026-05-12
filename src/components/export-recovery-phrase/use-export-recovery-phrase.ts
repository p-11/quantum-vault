import { useWallet } from '@/hooks/use-wallet';
import { attempt } from '@/lib/attempt';
import { ensurePresent } from '@/lib/assert';
import { toExistingVaultPasswordBytes } from '@/lib/password';
import { runSingleFlight } from '@/lib/single-flight';
import {
  clearSecretRef,
  replaceSecretRef,
  replaceZeroedRef
} from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

import {
  resolveExportRecoveryPhraseError,
  type SubmitPasswordErrorResult
} from './export-recovery-phrase-errors';
import {
  clearExportRecoveryPhraseRefs,
  toOwnedRecoveryPhraseBytes
} from './export-recovery-phrase-secrets';

const textEncoder = new TextEncoder();

export type SubmitPasswordResult =
  | 'success'
  | SubmitPasswordErrorResult
  | 'in-flight'
  | 'cancelled';

export type ExportRecoveryPhraseContextValue = {
  recoveryPhrase: Uint8Array | undefined;
  canSubmitPassword: boolean;
  isSubmittingPassword: boolean;
  setPassword: (password: string) => void;
  submitPassword: () => Promise<SubmitPasswordResult>;
  clearRecoveryPhrase: () => void;
  clearSensitiveState: () => void;
};

export const useExportRecoveryPhrase = (): ExportRecoveryPhraseContextValue => {
  const wallet = useWallet();
  const passwordRef = useRef<Uint8Array>(new Uint8Array());
  const recoveryPhraseRef = useRef<Uint8Array | undefined>(undefined);
  const submitPasswordInFlightRef =
    useRef<Promise<SubmitPasswordResult> | null>(null);
  const activeRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const [canSubmitPassword, setCanSubmitPassword] = useState(false);
  const [hasRecoveryPhrase, setHasRecoveryPhrase] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;

    // Authoritative zeroization on screen exit. Explicit callers
    // (handleDone, handleCancelConfirm) also call clearSensitiveState,
    // but this cleanup covers all unmount paths (popup close, idle lock,
    // navigation away from the export flow).
    return () => {
      isMountedRef.current = false;
      clearExportRecoveryPhraseRefs({
        activeRequestIdRef,
        passwordRef,
        recoveryPhraseRef
      });
    };
  }, []);

  const setPassword = (password: string) => {
    // Field input arrives as a JS string before encoding; this mirrors the
    // existing wallet creation/recovery flows and current UI-boundary limits.
    replaceSecretRef(passwordRef, textEncoder.encode(password));
    setCanSubmitPassword(passwordRef.current.length > 0);
  };

  const clearPassword = () => {
    clearSecretRef(passwordRef);
    if (isMountedRef.current) {
      setCanSubmitPassword(false);
    }
  };

  const clearRecoveryPhrase = () => {
    activeRequestIdRef.current += 1;
    const currentRecoveryPhrase = recoveryPhraseRef.current;
    if (currentRecoveryPhrase !== undefined) {
      currentRecoveryPhrase.fill(0);
      recoveryPhraseRef.current = undefined;
    }
    if (isMountedRef.current) {
      setHasRecoveryPhrase(false);
    }
  };

  const clearSensitiveState = () => {
    clearPassword();
    clearRecoveryPhrase();
  };

  const submitPassword = async (): Promise<SubmitPasswordResult> => {
    if (submitPasswordInFlightRef.current !== null) {
      return 'in-flight';
    }

    if (passwordRef.current.length === 0) {
      return {
        status: 'failed',
        reason: 'invalid-password',
        message: 'Export failed: Password is required'
      };
    }

    activeRequestIdRef.current += 1;
    const requestId = activeRequestIdRef.current;
    const passwordBytes = new Uint8Array(passwordRef.current);
    clearPassword();

    return ensurePresent(
      runSingleFlight({
        inFlightRef: submitPasswordInFlightRef,
        action: async () => {
          setIsSubmittingPassword(true);

          try {
            const exportResult = await attempt(() => {
              const password = toExistingVaultPasswordBytes(passwordBytes);
              return wallet.exportRecoveryPhrase(password);
            });

            if ('error' in exportResult) {
              return resolveExportRecoveryPhraseError(exportResult.error);
            }

            if (
              !isMountedRef.current ||
              activeRequestIdRef.current !== requestId
            ) {
              exportResult.data.fill(0);
              return 'cancelled';
            }

            replaceZeroedRef(
              recoveryPhraseRef,
              toOwnedRecoveryPhraseBytes(exportResult.data)
            );
            setHasRecoveryPhrase(true);
            return 'success';
          } finally {
            passwordBytes.fill(0);
            if (
              isMountedRef.current &&
              activeRequestIdRef.current === requestId
            ) {
              setIsSubmittingPassword(false);
            }
          }
        }
      }),
      'export recovery phrase password request'
    );
  };

  return {
    recoveryPhrase: hasRecoveryPhrase ? recoveryPhraseRef.current : undefined,
    canSubmitPassword,
    isSubmittingPassword,
    setPassword,
    submitPassword,
    clearRecoveryPhrase,
    clearSensitiveState
  };
};
