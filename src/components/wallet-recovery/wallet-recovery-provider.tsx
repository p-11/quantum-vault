import type { ReactNode } from 'react';

import { useWalletRecovery } from './use-wallet-recovery';
import { WalletRecoveryValueProvider } from './wallet-recovery-context';

export const WalletRecoveryProvider = ({
  children
}: {
  children: ReactNode;
}) => {
  const value = useWalletRecovery();
  return (
    <WalletRecoveryValueProvider value={value}>
      {children}
    </WalletRecoveryValueProvider>
  );
};
