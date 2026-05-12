import { WalletRecoveryContent } from './wallet-recovery-content';
import { WalletRecoveryProvider } from './wallet-recovery-provider';

export const WalletRecoveryScreen = () => (
  <WalletRecoveryProvider>
    <WalletRecoveryContent />
  </WalletRecoveryProvider>
);
