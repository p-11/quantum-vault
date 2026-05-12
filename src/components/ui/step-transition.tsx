import { useState, type ReactNode } from 'react';

type StepTransitionProps = {
  from: (props: { onFinish: () => void }) => ReactNode;
  to: (props: { onBack: () => void }) => ReactNode;
};

export const StepTransition = ({ from, to }: StepTransitionProps) => {
  const [isDone, setIsDone] = useState(false);

  if (!isDone) {
    return <>{from({ onFinish: () => setIsDone(true) })}</>;
  }

  return <>{to({ onBack: () => setIsDone(false) })}</>;
};
