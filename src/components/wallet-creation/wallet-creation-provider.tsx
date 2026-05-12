import type { ReactNode } from 'react';

import { WalletCreationValueProvider } from './wallet-creation-context';
import { useWalletCreation } from './use-wallet-creation';

export const WalletCreationProvider = ({
  children
}: {
  children: ReactNode;
}) => {
  const value = useWalletCreation();
  return (
    <WalletCreationValueProvider value={value}>
      {children}
    </WalletCreationValueProvider>
  );
};
