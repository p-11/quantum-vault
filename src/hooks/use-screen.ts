import type { AnimateScreenOptions } from '@/components/animate-screen';
import type { ScreenKey } from '@/screens';
import { createContext, useContext } from 'react';

export type Screen = {
  navigate: (
    _value: ScreenKey,
    options?: Partial<AnimateScreenOptions>
  ) => void;
  previousScreen: ScreenKey | null;
};

export const ScreenContext = createContext<Screen | undefined>(undefined);

export const useScreen = () => {
  const context = useContext(ScreenContext);

  if (!context) {
    throw new Error('useScreen must be used within a ScreenProvider');
  }

  return context;
};
