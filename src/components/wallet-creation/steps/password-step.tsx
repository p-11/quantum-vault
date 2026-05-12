import type { RefObject } from 'react';

import { PasswordStep as SharedPasswordStep } from '@/components/shared/password-step';

import { useWalletCreationContext } from '../wallet-creation-context';

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
    isSettingPassword,
    setPassword,
    setPasswordConfirmation
  } = useWalletCreationContext();

  return (
    <SharedPasswordStep
      passwordsMatch={passwordsMatch}
      passwordValidation={passwordValidation}
      canSubmit={canSubmitPassword}
      isSubmitting={isSettingPassword}
      onPasswordChange={setPassword}
      onPasswordConfirmationChange={setPasswordConfirmation}
      onSubmit={onSubmit}
      onBack={onBack}
      passwordInputRef={passwordInputRef}
      passwordConfirmationInputRef={passwordConfirmationInputRef}
    />
  );
};
