import { useWallet } from '@/hooks/use-wallet';
import { toValidatedNewPasswordBytes } from '@/lib/password';
import { withZeroed } from '@/lib/secrets-zeroing';
import { runSingleFlight } from '@/lib/single-flight';
import { areEqualBytes, clearSecretRef, replaceSecretRef } from '@/lib/utils';
import {
  Mnemonic,
  validatePassword,
  type PasswordValidationResult
} from '@project-eleven/libqc';
import { useCallback, useRef, useState } from 'react';

import { expectedRecoveryPhraseWordCount } from './core';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const spaceByte = 0x20;

export const useWalletRecovery = () => {
  const { recoverWallet } = useWallet();

  const wordsRef = useRef<Uint8Array[]>([]);

  const passwordRef = useRef<Uint8Array>(new Uint8Array());
  const passwordConfirmationRef = useRef<Uint8Array>(new Uint8Array());
  const mnemonicPhraseRef = useRef<Uint8Array>(new Uint8Array());
  const [passwordValidation, setPasswordValidation] =
    useState<PasswordValidationResult>(() =>
      validatePassword(new Uint8Array())
    );
  const [passwordsMatch, setPasswordsMatch] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [isRecovering, setIsRecovering] = useState(false);

  // Recovery is a local wallet mutation (not server query state). We gate it
  // with single-flight to prevent duplicate non-idempotent imports.
  const recoverInFlightRef = useRef<Promise<boolean> | null>(null);

  const canSubmitPassword = passwordValidation.valid && passwordsMatch;

  const hasFullPhrase = wordCount === expectedRecoveryPhraseWordCount;
  const syncPasswordValidationState = useCallback(() => {
    const nextPasswordValidation = validatePassword(passwordRef.current);
    const nextPasswordsMatch =
      passwordRef.current.length > 0 &&
      areEqualBytes(passwordRef.current, passwordConfirmationRef.current);
    setPasswordValidation(nextPasswordValidation);
    setPasswordsMatch(nextPasswordsMatch);
  }, []);

  const syncMnemonicPhrase = useCallback(() => {
    const totalLength =
      wordsRef.current.reduce((sum, wordBytes) => sum + wordBytes.length, 0) +
      Math.max(0, wordsRef.current.length - 1);
    const mnemonicBytes = new Uint8Array(totalLength);

    let offset = 0;
    for (let index = 0; index < wordsRef.current.length; index += 1) {
      const wordBytes = wordsRef.current[index];
      mnemonicBytes.set(wordBytes, offset);
      offset += wordBytes.length;
      if (index < wordsRef.current.length - 1) {
        mnemonicBytes[offset] = spaceByte;
        offset += 1;
      }
    }

    replaceSecretRef(mnemonicPhraseRef, mnemonicBytes);
  }, []);

  const setWords = useCallback(
    (nextWordsInput: string[] | ((currentWords: string[]) => string[])) => {
      const currentWords = wordsRef.current.map(wordBytes =>
        textDecoder.decode(wordBytes)
      );
      const nextWords =
        typeof nextWordsInput === 'function'
          ? nextWordsInput(currentWords)
          : nextWordsInput;

      for (const wordBytes of wordsRef.current) {
        wordBytes.fill(0);
      }
      wordsRef.current = nextWords.map(word => textEncoder.encode(word));
      syncMnemonicPhrase();
      setWordCount(wordsRef.current.length);
    },
    [syncMnemonicPhrase]
  );

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
    for (const wordBytes of wordsRef.current) {
      wordBytes.fill(0);
    }
    wordsRef.current = [];
    clearSecretRef(passwordRef);
    clearSecretRef(passwordConfirmationRef);
    clearSecretRef(mnemonicPhraseRef);
    setWordCount(0);
    syncPasswordValidationState();
  }, [syncPasswordValidationState]);

  const cancelRecovery = useCallback(() => {
    clearSensitiveState();
  }, [clearSensitiveState]);

  const recover = async (): Promise<boolean> => {
    if (!canSubmitPassword || !hasFullPhrase) {
      return false;
    }

    const request = runSingleFlight({
      inFlightRef: recoverInFlightRef,
      action: async () => {
        const secrets = (() => {
          try {
            return {
              validatedPassword: toValidatedNewPasswordBytes(
                passwordRef.current
              ),
              mnemonic: Mnemonic.from(mnemonicPhraseRef.current)
            };
          } finally {
            clearSensitiveState();
          }
        })();

        setIsRecovering(true);
        try {
          await withZeroed(
            [secrets.validatedPassword, secrets.mnemonic],
            async () =>
              recoverWallet(secrets.mnemonic, secrets.validatedPassword)
          );
          return true;
        } finally {
          setIsRecovering(false);
        }
      }
    });

    if (!request) {
      return false;
    }

    return request;
  };

  return {
    wordsBytes: wordsRef.current,
    wordCount,
    passwordValidation,
    passwordsMatch,
    canSubmitPassword,
    isRecovering,
    setWords,
    setPassword,
    setPasswordConfirmation,
    recover,
    cancelRecovery,
    clearSensitiveState
  };
};
