import { useState, type ReactNode } from 'react';

type ValueTransferProps<T> = {
  from: (props: { onFinish: (value: T) => void }) => ReactNode;
  to: (props: { value: T; onBack: () => void }) => ReactNode;
};

export const ValueTransfer = <T,>({ from, to }: ValueTransferProps<T>) => {
  const [value, setValue] = useState<T | null>(null);

  if (value === null) {
    return <>{from({ onFinish: setValue })}</>;
  }

  return <>{to({ value, onBack: () => setValue(null) })}</>;
};
