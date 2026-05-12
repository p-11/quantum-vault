import type { ReactNode, RefObject } from 'react';

import type { ExportRecoveryPhraseStep } from './core';
import { PasswordReconfirmStep } from './steps/password-reconfirm-step';
import { RecoveryPhraseRevealStep } from './steps/recovery-phrase-reveal-step';

type ExportRecoveryPhraseStepRenderersInput = {
  handleBack: () => void;
  handleDone: () => void;
  handlePasswordSubmit: () => void;
  passwordInputRef: RefObject<HTMLInputElement | null>;
};

export const getStepRenderers = ({
  handleBack,
  handleDone,
  handlePasswordSubmit,
  passwordInputRef
}: ExportRecoveryPhraseStepRenderersInput) =>
  ({
    'password-reconfirm': () => (
      <PasswordReconfirmStep
        onSubmit={handlePasswordSubmit}
        onBack={handleBack}
        passwordInputRef={passwordInputRef}
      />
    ),
    'recovery-phrase-reveal': () => (
      <RecoveryPhraseRevealStep onExit={handleDone} />
    )
  }) satisfies Record<ExportRecoveryPhraseStep, () => ReactNode>;
