import {
  AnimateScreen,
  type AnimateScreenOptions
} from '@/components/animate-screen';
import { Screen } from '@/components/screen';
import { CancelConfirmationModal } from '@/components/shared/cancel-confirmation-modal';
import { useBoolean } from '@/hooks/use-boolean';
import { useScreen } from '@/hooks/use-screen';
import { useWallet } from '@/hooks/use-wallet';
import { useStepNavigation } from '@/hooks/use-step-navigation';
import { zeroOut } from '@/lib/utils';
import { AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { exportRecoveryPhraseSteps } from './core';
import { exportRecoveryPhraseCopy } from './export-recovery-phrase-copy';
import {
  backSlideAnimateOptions,
  forwardSlideAnimateOptions
} from './export-recovery-phrase-content.constants';
import { useExportRecoveryPhraseContext } from './export-recovery-phrase-context';
import { getStepRenderers } from './export-recovery-phrase-step-renderers';
import type { SubmitPasswordResult } from './use-export-recovery-phrase';

export const ExportRecoveryPhraseContent = () => {
  const { navigate } = useScreen();
  const { clearWalletState } = useWallet();
  const {
    clearRecoveryPhrase,
    clearSensitiveState,
    isSubmittingPassword,
    submitPassword
  } = useExportRecoveryPhraseContext();
  const [showCancelConfirmation, cancelConfirmation] = useBoolean();
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const [animateScreenOptions, setAnimateScreenOptions] =
    useState<AnimateScreenOptions>(forwardSlideAnimateOptions);

  const { currentStep, toNextStep, toPreviousStep } = useStepNavigation({
    steps: exportRecoveryPhraseSteps,
    onExit: cancelConfirmation.set
  });

  useEffect(() => {
    return () => {
      zeroOut(passwordInputRef);
    };
  }, []);

  const handleNext = () => {
    setAnimateScreenOptions(forwardSlideAnimateOptions);
    toNextStep();
  };

  const handleBack = () => {
    if (currentStep === 'recovery-phrase-reveal') {
      clearRecoveryPhrase();
    }
    setAnimateScreenOptions(backSlideAnimateOptions);
    toPreviousStep();
  };

  const handlePasswordSubmit = async () => {
    if (isSubmittingPassword) {
      return;
    }

    zeroOut(passwordInputRef);
    const submitResult = await submitPassword();
    handlePasswordSubmitResult(submitResult);
  };

  const handlePasswordSubmitResult = (submitResult: SubmitPasswordResult) => {
    if (typeof submitResult !== 'string') {
      toast.error(submitResult.message);

      if (submitResult.reason === 'locked') {
        clearSensitiveState();
        clearWalletState();
        navigate('lock', { direction: 'back', type: 'fade' });
      }

      return;
    }

    const submitPasswordResultHandlers: Record<
      Extract<SubmitPasswordResult, string>,
      () => void
    > = {
      success: handleNext,
      'in-flight': () => undefined,
      cancelled: () => undefined
    };

    submitPasswordResultHandlers[submitResult]();
  };

  const handleDone = () => {
    clearSensitiveState();
    navigate('settings', { direction: 'back' });
  };

  const handleCancelConfirm = () => {
    if (isSubmittingPassword) {
      return;
    }

    clearSensitiveState();
    cancelConfirmation.unset();
    navigate('settings', { direction: 'back' });
  };

  const stepRenderers = getStepRenderers({
    handleBack,
    handleDone,
    handlePasswordSubmit,
    passwordInputRef
  });

  return (
    <>
      <Screen className='sharp'>
        <div className='flex flex-1 flex-col overflow-x-hidden overflow-y-auto'>
          <AnimatePresence
            mode='wait'
            custom={animateScreenOptions}
            initial={false}
          >
            <AnimateScreen
              key={currentStep}
              custom={animateScreenOptions}
              className='flex flex-1 flex-col'
            >
              {stepRenderers[currentStep]()}
            </AnimateScreen>
          </AnimatePresence>
        </div>
      </Screen>

      <CancelConfirmationModal
        open={showCancelConfirmation}
        onConfirm={handleCancelConfirm}
        onDismiss={cancelConfirmation.unset}
        isConfirmDisabled={isSubmittingPassword}
        title={exportRecoveryPhraseCopy.cancelModal.title}
        description={exportRecoveryPhraseCopy.cancelModal.description}
      />
    </>
  );
};
