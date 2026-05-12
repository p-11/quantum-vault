import { useWallet } from '@/hooks/use-wallet';
import { notifyVaultSessionStateChanged } from '@/hooks/use-session-timeout';
import { toValidatedNewPasswordBytes } from '@/lib/password';
import { withZeroed } from '@/lib/secrets-zeroing';
import { runSingleFlight } from '@/lib/single-flight';
import {
  areEqualBytes,
  clearOptionalSecretRef,
  clearSecretRef,
  replaceSecretRef,
  replaceZeroedRef
} from '@/lib/utils';
import {
  validatePassword,
  Mnemonic,
  type PasswordValidationResult
} from '@project-eleven/libqc';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  confirmIdentityCooldownMs,
  maxConfirmIdentityAttempts
} from './constants';

const textEncoder = new TextEncoder();

type ConfirmIdentityRateLimitState = {
  failedAttempts: number;
  cooldownUntil: number | null;
};

const getInitialConfirmIdentityRateLimitState =
  (): ConfirmIdentityRateLimitState => ({
    failedAttempts: 0,
    cooldownUntil: null
  });

export const useWalletCreation = () => {
  const { vault, clearWalletState, ensureDefaultAccounts } = useWallet();

  const passwordRef = useRef<Uint8Array>(new Uint8Array());
  const passwordConfirmationRef = useRef<Uint8Array>(new Uint8Array());
  const mnemonicRef = useRef<Mnemonic | undefined>(undefined);
  const [passwordValidation, setPasswordValidation] =
    useState<PasswordValidationResult>(() =>
      validatePassword(new Uint8Array())
    );
  const [passwordsMatch, setPasswordsMatch] = useState(false);
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);

  // Confirm-identity rate limiting lives at the feature level so it survives
  // AnimatePresence unmounting the step on back-navigation. Colocating inside
  // the step component would let a user bypass the cooldown by navigating
  // back then returning to the step.
  const [confirmIdentityRateLimitState, setConfirmIdentityRateLimitState] =
    useState<ConfirmIdentityRateLimitState>(
      getInitialConfirmIdentityRateLimitState
    );

  const submitPasswordInFlightRef = useRef<Promise<boolean> | null>(null);
  const createWalletInFlightRef = useRef<Promise<boolean> | null>(null);

  const canSubmitPassword = passwordValidation.valid && passwordsMatch;
  const syncPasswordValidationState = useCallback(() => {
    const nextPasswordValidation = validatePassword(passwordRef.current);
    const nextPasswordsMatch =
      passwordRef.current.length > 0 &&
      areEqualBytes(passwordRef.current, passwordConfirmationRef.current);
    setPasswordValidation(nextPasswordValidation);
    setPasswordsMatch(nextPasswordsMatch);
  }, []);

  const setPassword = useCallback(
    (password: string) => {
      replaceSecretRef(passwordRef, textEncoder.encode(password));
      syncPasswordValidationState();
    },
    [syncPasswordValidationState]
  );

  const setPasswordConfirmation = useCallback(
    (passwordConfirmation: string) => {
      replaceSecretRef(
        passwordConfirmationRef,
        textEncoder.encode(passwordConfirmation)
      );
      syncPasswordValidationState();
    },
    [syncPasswordValidationState]
  );

  const clearSensitiveState = useCallback(() => {
    clearSecretRef(passwordRef);
    clearSecretRef(passwordConfirmationRef);
    clearOptionalSecretRef(mnemonicRef);
    syncPasswordValidationState();
  }, [syncPasswordValidationState]);

  const clearConfirmIdentityCooldown = useCallback(() => {
    setConfirmIdentityRateLimitState(getInitialConfirmIdentityRateLimitState());
  }, []);

  useEffect(() => {
    if (confirmIdentityRateLimitState.cooldownUntil === null) {
      return;
    }

    const remainingCooldownMs =
      confirmIdentityRateLimitState.cooldownUntil - Date.now();
    if (remainingCooldownMs <= 0) {
      clearConfirmIdentityCooldown();
      return;
    }

    const cooldownTimerId = setTimeout(() => {
      clearConfirmIdentityCooldown();
    }, remainingCooldownMs);

    return () => clearTimeout(cooldownTimerId);
  }, [
    clearConfirmIdentityCooldown,
    confirmIdentityRateLimitState.cooldownUntil
  ]);

  const recordConfirmIdentityFailure = useCallback(() => {
    setConfirmIdentityRateLimitState(previousState => {
      const now = Date.now();
      const hasActiveCooldown =
        previousState.cooldownUntil !== null &&
        previousState.cooldownUntil > now;
      const baseFailedAttempts =
        previousState.cooldownUntil === null || hasActiveCooldown
          ? previousState.failedAttempts
          : 0;
      const nextFailedAttempts = baseFailedAttempts + 1;

      if (nextFailedAttempts < maxConfirmIdentityAttempts) {
        return {
          failedAttempts: nextFailedAttempts,
          cooldownUntil: hasActiveCooldown ? previousState.cooldownUntil : null
        };
      }

      return {
        failedAttempts: nextFailedAttempts,
        cooldownUntil:
          hasActiveCooldown && previousState.cooldownUntil !== null
            ? previousState.cooldownUntil
            : now + confirmIdentityCooldownMs
      };
    });
  }, []);

  const submitPassword = async (): Promise<boolean> => {
    if (!canSubmitPassword) {
      return false;
    }

    const request = runSingleFlight({
      inFlightRef: submitPasswordInFlightRef,
      action: async () => {
        setIsSettingPassword(true);
        try {
          const validatedPassword = (() => {
            try {
              return toValidatedNewPasswordBytes(passwordRef.current);
            } finally {
              clearSecretRef(passwordRef);
              clearSecretRef(passwordConfirmationRef);
              syncPasswordValidationState();
            }
          })();

          await withZeroed(validatedPassword, async () => {
            await vault.setPassword(validatedPassword);
            notifyVaultSessionStateChanged();
            await vault.generateMnemonic(mnemonic => {
              replaceZeroedRef(mnemonicRef, Mnemonic.from(mnemonic));
            });
          });
          await ensureDefaultAccounts();
          return true;
        } finally {
          setIsSettingPassword(false);
        }
      }
    });

    if (!request) {
      return false;
    }

    return request;
  };

  const createWallet = async (): Promise<boolean> => {
    const request = runSingleFlight({
      inFlightRef: createWalletInFlightRef,
      action: async () => {
        setIsCreatingWallet(true);
        try {
          await ensureDefaultAccounts();
          return true;
        } finally {
          setIsCreatingWallet(false);
        }
      }
    });

    if (!request) {
      return false;
    }

    return request;
  };

  const cancelCreation = useCallback(async () => {
    clearSensitiveState();
    clearConfirmIdentityCooldown();
    await vault.clearState();
    clearWalletState();
  }, [
    clearConfirmIdentityCooldown,
    clearSensitiveState,
    clearWalletState,
    vault
  ]);

  const now = Date.now();
  const isConfirmIdentityCooldownActive =
    confirmIdentityRateLimitState.cooldownUntil !== null &&
    confirmIdentityRateLimitState.cooldownUntil > now;
  const confirmIdentityFailedAttempts =
    confirmIdentityRateLimitState.cooldownUntil === null ||
    isConfirmIdentityCooldownActive
      ? confirmIdentityRateLimitState.failedAttempts
      : 0;
  const confirmIdentityCooldownUntil = isConfirmIdentityCooldownActive
    ? confirmIdentityRateLimitState.cooldownUntil
    : null;

  return {
    mnemonic: mnemonicRef.current,
    isSettingPassword,
    isCreatingWallet,
    passwordValidation,
    passwordsMatch,
    canSubmitPassword,
    confirmIdentityFailedAttempts,
    confirmIdentityCooldownUntil,
    setPassword,
    setPasswordConfirmation,
    submitPassword,
    createWallet,
    cancelCreation,
    clearSensitiveState,
    recordConfirmIdentityFailure,
    clearConfirmIdentityCooldown
  };
};
