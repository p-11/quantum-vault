import { setupValueProvider } from '@/lib/state';

import type { useWalletCreation } from './use-wallet-creation';

type WalletCreationContextValue = ReturnType<typeof useWalletCreation>;

export const [WalletCreationValueProvider, useWalletCreationContext] =
  setupValueProvider<WalletCreationContextValue>('WalletCreation');
