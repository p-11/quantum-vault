import {
  AnimateScreen,
  type AnimateScreenOptions
} from '@/components/animate-screen';
import { Screen } from '@/components/screen';
import { CancelConfirmationModal } from '@/components/shared/cancel-confirmation-modal';
import { CreatingWalletLoader } from '@/components/shared/creating-wallet-loader';
import { useBoolean } from '@/hooks/use-boolean';
import { useScreen } from '@/hooks/use-screen';
import { useStepNavigation } from '@/hooks/use-step-navigation';
import { attempt } from '@/lib/attempt';
import { toastMessages } from '@/lib/content';
import { zeroOut } from '@/lib/utils';
import { LibQC } from '@project-eleven/libqc';
import { AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { expectedRecoveryPhraseWordCount, walletRecoverySteps } from './core';
import {
  backSlideAnimateOptions,
  forwardFadeAnimateOptions,
  forwardSlideAnimateOptions,
  recoveryCancelModalCopy,
  recoveryLoaderMessage
} from './wallet-recovery-content.constants';
import { useWalletRecoveryContext } from './wallet-recovery-context';
import { getStepRenderers } from './wallet-recovery-step-renderers';

const textEncoder = new TextEncoder();

export const WalletRecoveryContent = () => {
  const { navigate, previousScreen } = useScreen();
  const walletRecovery = useWalletRecoveryContext();
  const { clearSensitiveState, cancelRecovery } = walletRecovery;
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const passwordConfirmationInputRef = useRef<HTMLInputElement>(null);
  const [showCancelConfirmation, cancelConfirmation] = useBoolean();
  const [animateScreenOptions, setAnimateScreenOptions] =
    useState<AnimateScreenOptions>(forwardSlideAnimateOptions);

  const { currentStep, toNextStep, toPreviousStep } = useStepNavigation({
    steps: walletRecoverySteps,
    onExit: cancelConfirmation.set
  });

  useEffect(() => {
    return () => {
      zeroOut(passwordInputRef);
      zeroOut(passwordConfirmationInputRef);
      clearSensitiveState();
    };
  }, [clearSensitiveState]);

  const passwordValidation = walletRecovery.passwordValidation;
  const passwordsMatch = walletRecovery.passwordsMatch;

  const handleNext = () => {
    setAnimateScreenOptions(forwardSlideAnimateOptions);
    toNextStep();
  };

  const handleBack = () => {
    setAnimateScreenOptions(backSlideAnimateOptions);
    toPreviousStep();
  };

  const handlePhraseSubmit = (phraseWords: readonly string[]) => {
    if (phraseWords.length !== expectedRecoveryPhraseWordCount) {
      return;
    }

    // libqc validation errors may reference user-entered words. Never forward
    // the raw error message - always use a generic toast to avoid echoing any
    // part of the mnemonic back to the UI or logs.
    const mnemonicBytes = textEncoder.encode(phraseWords.join(' '));
    const result = attempt(() => LibQC.validateMnemonic(mnemonicBytes));
    mnemonicBytes.fill(0);
    if ('error' in result) {
      toast.error(toastMessages.invalidSecretPhrase);
      return;
    }

    handleNext();
  };

  const handleRecoverSubmit = async () => {
    if (walletRecovery.isRecovering) {
      return;
    }
    if (!passwordValidation.valid || !passwordsMatch) {
      return;
    }

    zeroOut(passwordInputRef);
    zeroOut(passwordConfirmationInputRef);

    setAnimateScreenOptions(forwardFadeAnimateOptions);

    // Same secret-hygiene rule as handlePhraseSubmit: recoverWallet errors may
    // embed mnemonic-derived context, so route every failure through the
    // generic toast.
    const result = await attempt(() => walletRecovery.recover());
    if ('error' in result) {
      setAnimateScreenOptions(backSlideAnimateOptions);
      toPreviousStep();
      toast.error(toastMessages.unexpectedError);
      return;
    }
    if (!result.data) {
      return;
    }

    clearSensitiveState();
    navigate('home', { direction: 'forward', type: 'fade' });
  };

  const handleCancelConfirm = () => {
    if (walletRecovery.isRecovering) {
      return;
    }
    cancelRecovery();
    cancelConfirmation.unset();
    navigate(previousScreen ?? 'initial', { direction: 'back' });
  };

  const stepRenderers = getStepRenderers({
    handleBack,
    handlePhraseSubmit,
    handleRecoverSubmit,
    passwordInputRef,
    passwordConfirmationInputRef
  });

  return (
    <>
      <Screen className='sharp'>
        <div className='flex flex-1 flex-col overflow-hidden'>
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
              {walletRecovery.isRecovering ? (
                <CreatingWalletLoader message={recoveryLoaderMessage} />
              ) : (
                stepRenderers[currentStep]()
              )}
            </AnimateScreen>
          </AnimatePresence>
        </div>
      </Screen>

      <CancelConfirmationModal
        open={showCancelConfirmation}
        onConfirm={handleCancelConfirm}
        onDismiss={cancelConfirmation.unset}
        isConfirmDisabled={walletRecovery.isRecovering}
        title={recoveryCancelModalCopy.title}
        description={recoveryCancelModalCopy.description}
      />
    </>
  );
};
