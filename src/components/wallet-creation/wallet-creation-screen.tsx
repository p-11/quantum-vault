import { WalletCreationContent } from './wallet-creation-content';
import { WalletCreationProvider } from './wallet-creation-provider';

export const WalletCreationScreen = () => (
  <WalletCreationProvider>
    <WalletCreationContent />
  </WalletCreationProvider>
);
