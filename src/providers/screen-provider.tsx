import {
  AnimateScreen,
  type AnimateScreenOptions
} from '@/components/animate-screen';
import { ScreenContext } from '@/hooks/use-screen';
import { useSessionTimeout } from '@/hooks/use-session-timeout';
import { hasSeenOnboarding } from '@/lib/onboarding';
import { useWalletBootQuery } from '@/providers/wallet-queries';
import { useWallet } from '@/hooks/use-wallet';
import { screens, type ScreenKey } from '@/screens';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import { useEffect, useState } from 'react';
import { resolveHydrationScreen } from './screen-provider-core';

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used for NavigationDirection derivation
const navigationDirections = ['back', 'forward'] as const;

export type NavigationDirection = (typeof navigationDirections)[number];

const defaultAnimationOptions: AnimateScreenOptions = {
  direction: 'forward',
  type: 'slide'
};

type NavigationState = {
  activeScreen: ScreenKey;
  previousScreen: ScreenKey | null;
};

export const ScreenProvider = () => {
  const [navigationState, setNavigationState] = useState<NavigationState>({
    activeScreen: 'initial',
    previousScreen: null
  });

  const [isLoading, setIsLoading] = useState(true);
  const [shouldRunHydration, setShouldRunHydration] = useState(true);

  const [animateScreenOptions, setAnimateScreenOptions] =
    useState<AnimateScreenOptions>(defaultAnimationOptions);

  const { vault, initWallet, clearWalletState } = useWallet();
  const walletBootQuery = useWalletBootQuery({
    initWallet,
    isEnabled: shouldRunHydration,
    vault
  });

  const navigate = (
    screenKey: ScreenKey,
    options?: Partial<AnimateScreenOptions>
  ) => {
    setAnimateScreenOptions({
      direction: options?.direction ?? defaultAnimationOptions.direction,
      type: options?.type ?? defaultAnimationOptions.type
    });

    setNavigationState(prev => ({
      activeScreen: screenKey,
      previousScreen: prev.activeScreen
    }));
  };

  const handleSessionTimeout = () => {
    clearWalletState();
    navigate('lock', { direction: 'back', type: 'fade' });
  };

  useSessionTimeout({
    activeScreen: navigationState.activeScreen,
    isVaultUnlocked: () => vault.isUnlocked(),
    onTimeout: handleSessionTimeout
  });

  useEffect(() => {
    if (!shouldRunHydration || walletBootQuery.isPending) {
      return;
    }

    const navigateFromHydration = (
      screenKey: ScreenKey,
      options?: Partial<AnimateScreenOptions>
    ) => {
      setAnimateScreenOptions({
        direction: options?.direction ?? defaultAnimationOptions.direction,
        type: options?.type ?? defaultAnimationOptions.type
      });

      setNavigationState(prev => ({
        activeScreen: screenKey,
        previousScreen: prev.activeScreen
      }));
    };

    if (walletBootQuery.isError || !walletBootQuery.data) {
      void clearWalletState();
      navigateFromHydration('lock', { type: 'fade' });
      setShouldRunHydration(false);
      setIsLoading(false);
      return;
    }

    const nextScreen = resolveHydrationScreen({
      hydrationState: walletBootQuery.data,
      isOnboardingSeen: hasSeenOnboarding()
    });

    navigateFromHydration(nextScreen, {
      direction: 'forward',
      type: 'fade'
    });
    setShouldRunHydration(false);
    setIsLoading(false);
  }, [
    clearWalletState,
    shouldRunHydration,
    walletBootQuery.data,
    walletBootQuery.isError,
    walletBootQuery.isPending
  ]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const bootShellElement = document.getElementById('boot-shell');

    if (!bootShellElement) {
      return;
    }

    bootShellElement.dataset.state = 'hidden';
    bootShellElement.remove();
  }, [isLoading]);

  if (isLoading) {
    return null;
  }

  return (
    <ScreenContext.Provider
      value={{
        navigate,
        previousScreen: navigationState.previousScreen
      }}
    >
      <MotionConfig transition={{ duration: 0.1 }}>
        <AnimatePresence
          initial={false}
          mode='wait'
          custom={animateScreenOptions}
        >
          {Object.keys(screens).map(screenKey => {
            if (screenKey === navigationState.activeScreen) {
              return (
                <AnimateScreen key={screenKey} custom={animateScreenOptions}>
                  {screens[navigationState.activeScreen]}
                </AnimateScreen>
              );
            } else {
              return null;
            }
          })}
        </AnimatePresence>
      </MotionConfig>
    </ScreenContext.Provider>
  );
};
