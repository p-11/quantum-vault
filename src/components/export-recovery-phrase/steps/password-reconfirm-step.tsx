import { Loader2Icon } from 'lucide-react';
import type { RefObject } from 'react';

import { FlowStepFooter } from '@/components/shared/flow-step-footer';
import { FlowStepHeader } from '@/components/shared/flow-step-header';
import { PasswordRevealToggle } from '@/components/shared/password-reveal-toggle';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { useBoolean } from '@/hooks/use-boolean';

import { exportRecoveryPhraseStepContainerClassName } from '../core';
import { useExportRecoveryPhraseContext } from '../export-recovery-phrase-context';

type PasswordReconfirmStepProps = {
  onSubmit: () => void;
  onBack: () => void;
  passwordInputRef: RefObject<HTMLInputElement | null>;
};

export const PasswordReconfirmStep = ({
  onSubmit,
  onBack,
  passwordInputRef
}: PasswordReconfirmStepProps) => {
  const { canSubmitPassword, isSubmittingPassword, setPassword } =
    useExportRecoveryPhraseContext();
  const [isPasswordRevealed, passwordReveal] = useBoolean();

  const isSubmitDisabled = !canSubmitPassword || isSubmittingPassword;

  const handleSubmit = () => {
    if (isSubmitDisabled) {
      return;
    }
    onSubmit();
  };

  return (
    <div className={exportRecoveryPhraseStepContainerClassName}>
      <div>
        <FlowStepHeader
          title='Confirm Your Password'
          description='To export your recovery phrase, re-enter your wallet password.'
          onBack={onBack}
          backDisabled={isSubmittingPassword}
          backTestId='export-recovery-phrase-back-button'
        />

        <div className='mt-8'>
          <Field
            label='Password'
            type={isPasswordRevealed ? 'text' : 'password'}
            onChange={setPassword}
            disabled={isSubmittingPassword}
            placeholder='Enter your password'
            autoFocus
            autoComplete='current-password'
            inputRef={passwordInputRef}
            onSubmit={handleSubmit}
            trailingAddon={
              <PasswordRevealToggle
                isRevealed={isPasswordRevealed}
                onToggle={passwordReveal.toggle}
                disabled={isSubmittingPassword}
              />
            }
          />
        </div>
      </div>

      <FlowStepFooter>
        <Button size='flow' disabled={isSubmitDisabled} onClick={handleSubmit}>
          {isSubmittingPassword ? (
            <Loader2Icon className='animate-spin' />
          ) : (
            'Continue'
          )}
        </Button>
      </FlowStepFooter>
    </div>
  );
};
