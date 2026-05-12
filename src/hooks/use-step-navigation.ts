import { useState } from 'react';

type UseStepNavigationInput<T extends string> = {
  steps: readonly [T, ...T[]];
  onExit?: () => void;
};

export const useStepNavigation = <T extends string>({
  steps,
  onExit
}: UseStepNavigationInput<T>) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const currentStep = steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  const toNextStep = () => {
    if (!isLastStep) {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const toPreviousStep = () => {
    if (isFirstStep) {
      onExit?.();
      return;
    }
    setCurrentStepIndex(prev => prev - 1);
  };

  const goToStep = (step: T) => {
    const targetIndex = steps.indexOf(step);
    if (targetIndex >= 0) {
      setCurrentStepIndex(targetIndex);
    }
  };

  return {
    currentStep,
    currentStepIndex,
    toNextStep,
    toPreviousStep,
    goToStep,
    isFirstStep,
    isLastStep
  };
};
