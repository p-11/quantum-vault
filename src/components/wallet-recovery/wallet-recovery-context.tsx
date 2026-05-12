import { setupValueProvider } from '@/lib/state';

import type { useWalletRecovery } from './use-wallet-recovery';

type WalletRecoveryContextValue = ReturnType<typeof useWalletRecovery>;

export const [WalletRecoveryValueProvider, useWalletRecoveryContext] =
  setupValueProvider<WalletRecoveryContextValue>('WalletRecovery');
