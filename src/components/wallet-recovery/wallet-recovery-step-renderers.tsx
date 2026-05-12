import type { RefObject, ReactNode } from 'react';

import type { WalletRecoveryStep } from './core';
import { PasswordStep } from './steps/password-step';
import { PhraseEntryStep } from './steps/phrase-entry-step';

type WalletRecoveryStepRenderersInput = {
  handleBack: () => void;
  handlePhraseSubmit: (phraseWords: readonly string[]) => void;
  handleRecoverSubmit: () => void;
  passwordInputRef: RefObject<HTMLInputElement | null>;
  passwordConfirmationInputRef: RefObject<HTMLInputElement | null>;
};

export const getStepRenderers = ({
  handleBack,
  handlePhraseSubmit,
  handleRecoverSubmit,
  passwordInputRef,
  passwordConfirmationInputRef
}: WalletRecoveryStepRenderersInput) =>
  ({
    'phrase-entry': () => (
      <PhraseEntryStep onBack={handleBack} onSubmit={handlePhraseSubmit} />
    ),
    password: () => (
      <PasswordStep
        onSubmit={handleRecoverSubmit}
        onBack={handleBack}
        passwordInputRef={passwordInputRef}
        passwordConfirmationInputRef={passwordConfirmationInputRef}
      />
    )
  }) satisfies Record<WalletRecoveryStep, () => ReactNode>;
