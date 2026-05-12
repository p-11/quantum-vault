import type { RefObject } from 'react';

import { PasswordStep as SharedPasswordStep } from '@/components/shared/password-step';

import { useWalletRecoveryContext } from '../wallet-recovery-context';

type PasswordStepProps = {
  onSubmit: () => void;
  onBack: () => void;
  passwordInputRef?: RefObject<HTMLInputElement | null>;
  passwordConfirmationInputRef?: RefObject<HTMLInputElement | null>;
};

export const PasswordStep = ({
  onSubmit,
  onBack,
  passwordInputRef,
  passwordConfirmationInputRef
}: PasswordStepProps) => {
  const {
    passwordValidation,
    passwordsMatch,
    canSubmitPassword,
    isRecovering,
    setPassword,
    setPasswordConfirmation
  } = useWalletRecoveryContext();

  return (
    <SharedPasswordStep
      passwordsMatch={passwordsMatch}
      passwordValidation={passwordValidation}
      canSubmit={canSubmitPassword}
      isSubmitting={isRecovering}
      onPasswordChange={setPassword}
      onPasswordConfirmationChange={setPasswordConfirmation}
      onSubmit={onSubmit}
      onBack={onBack}
      passwordInputRef={passwordInputRef}
      passwordConfirmationInputRef={passwordConfirmationInputRef}
    />
  );
};
