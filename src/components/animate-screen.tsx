import type { ReactNode } from 'react';

import type { NavigationDirection } from '@/providers/screen-provider';
import { motion, type TargetAndTransition, type Variants } from 'framer-motion';

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used for TransitionType derivation
const transitionTypes = ['fade', 'slide'] as const;

type TransitionType = (typeof transitionTypes)[number];

export type AnimateScreenOptions = {
  direction: NavigationDirection;
  type: TransitionType;
};

const slideDirectionOffset: Record<NavigationDirection, string> = {
  forward: '100%',
  back: '-100%'
};

const reverseSlideDirectionOffset: Record<NavigationDirection, string> = {
  forward: '-100%',
  back: '100%'
};

const transitionInitial: Record<
  TransitionType,
  (direction: NavigationDirection) => TargetAndTransition
> = {
  slide: direction => ({ x: slideDirectionOffset[direction] }),
  fade: () => ({ opacity: 0 })
};

const transitionTarget: Record<TransitionType, () => TargetAndTransition> = {
  slide: () => ({ x: '0%' }),
  fade: () => ({ opacity: 1 })
};

const transitionExit: Record<
  TransitionType,
  (direction: NavigationDirection) => TargetAndTransition
> = {
  slide: direction => ({ x: reverseSlideDirectionOffset[direction] }),
  fade: () => ({ opacity: 0 })
};

const variants: Variants = {
  initial: (options: AnimateScreenOptions) =>
    transitionInitial[options.type](options.direction),
  target: (options: AnimateScreenOptions) => transitionTarget[options.type](),
  exit: (options: AnimateScreenOptions) =>
    transitionExit[options.type](options.direction)
};

export const AnimateScreen = ({
  children,
  custom,
  className
}: {
  children: ReactNode;
  custom: AnimateScreenOptions;
  className?: string;
}) => (
  <motion.div
    className={className}
    initial='initial'
    animate='target'
    exit='exit'
    custom={custom}
    variants={variants}
  >
    {children}
  </motion.div>
);
