import type { RefObject } from 'react';
import type { PasswordValidationResult } from '@project-eleven/libqc';
import { Loader2Icon } from 'lucide-react';

import { FlowStepFooter } from '@/components/shared/flow-step-footer';
import { FlowStepHeader } from '@/components/shared/flow-step-header';
import { PasswordForm } from '@/components/shared/password-form';
import { Button } from '@/components/ui/button';

type PasswordStepProps = {
  passwordsMatch: boolean;
  passwordValidation: PasswordValidationResult;
  canSubmit: boolean;
  isSubmitting: boolean;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmationChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  passwordInputRef?: RefObject<HTMLInputElement | null>;
  passwordConfirmationInputRef?: RefObject<HTMLInputElement | null>;
};

const passwordStepTitle = 'Create a Password';
const passwordStepDescription =
  "This password unlocks Quantum Vault on this device. It can't recover your wallet if you lose it.";

/**
 * Shared new-password step used by every flow that needs to collect a
 * passphrase (wallet creation, wallet recovery). Flow-specific wrappers
 * translate their feature context into this shell's validation metadata while
 * keeping plaintext secret bytes out of the component API and preserving a
 * consistent reveal/validation UX.
 */
export const PasswordStep = ({
  passwordsMatch,
  passwordValidation,
  canSubmit,
  isSubmitting,
  onPasswordChange,
  onPasswordConfirmationChange,
  onSubmit,
  onBack,
  passwordInputRef,
  passwordConfirmationInputRef
}: PasswordStepProps) => {
  const isSubmitDisabled = !canSubmit || isSubmitting;

  const handleSubmit = () => {
    if (isSubmitDisabled) {
      return;
    }
    onSubmit();
  };

  return (
    <div className='flex flex-1 min-h-0 flex-col justify-between'>
      <div>
        <FlowStepHeader
          title={passwordStepTitle}
          description={passwordStepDescription}
          onBack={onBack}
          backDisabled={isSubmitting}
        />

        <div className='mt-8'>
          <PasswordForm
            passwordsMatch={passwordsMatch}
            passwordValidation={passwordValidation}
            onPasswordChange={onPasswordChange}
            onPasswordConfirmationChange={onPasswordConfirmationChange}
            onSubmit={handleSubmit}
            passwordInputRef={passwordInputRef}
            passwordConfirmationInputRef={passwordConfirmationInputRef}
          />
        </div>
      </div>

      <FlowStepFooter>
        <Button size='flow' disabled={isSubmitDisabled} onClick={handleSubmit}>
          {isSubmitting ? <Loader2Icon className='animate-spin' /> : 'Continue'}
        </Button>
      </FlowStepFooter>
    </div>
  );
};
