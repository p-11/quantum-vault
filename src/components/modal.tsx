import { AnimatePresence, motion } from 'framer-motion';

const overlayVariants = {
  initial: {
    opacity: 0
  },
  target: {
    opacity: 1
  },
  exit: {
    opacity: 0
  }
};

const panelVariants = {
  initial: {
    y: '100%'
  },
  target: {
    y: 0
  },
  exit: {
    y: '100%'
  }
};

export const Modal = ({
  children,
  show,
  onDismiss,
  dismissible = true
}: {
  children: React.ReactNode;
  show: boolean;
  onDismiss(): void;
  dismissible?: boolean;
}) => (
  <AnimatePresence>
    {show && (
      <>
        <motion.div
          initial='initial'
          animate='target'
          exit='exit'
          className='bg-primary/50 fixed top-0 left-0 right-0 bottom-0 z-10'
          variants={overlayVariants}
          onClick={dismissible ? onDismiss : undefined}
        />

        <motion.div
          initial='initial'
          animate='target'
          exit='exit'
          variants={panelVariants}
          className='z-20 fixed bottom-0 w-full bg-background'
        >
          {children}
        </motion.div>
      </>
    )}
  </AnimatePresence>
);
