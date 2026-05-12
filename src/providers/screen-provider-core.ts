import { match } from '@/lib/match';
import type { ScreenKey } from '@/screens';

import type { WalletHydrationState } from './wallet-queries';

export const resolveHydrationScreen = ({
  hydrationState,
  isOnboardingSeen
}: {
  hydrationState: WalletHydrationState;
  isOnboardingSeen: boolean;
}): ScreenKey => {
  if (hydrationState.kind === 'no-password') {
    return isOnboardingSeen ? 'initial' : 'onboarding';
  }

  if (hydrationState.kind === 'locked') {
    return 'lock';
  }

  return match(hydrationState.initWalletResult, {
    ready: () => 'home',
    degraded: () => 'home',
    ignored: () => 'lock'
  });
};
