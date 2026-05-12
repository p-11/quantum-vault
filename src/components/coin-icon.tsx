import { AnimatePresence, motion } from 'framer-motion';

export const CoinIcon = ({
  iconUrl,
  networkIconUrl
}: {
  iconUrl: string;
  networkIconUrl?: string;
}) => (
  <div className='relative'>
    <img
      src={iconUrl}
      className='size-9.5 rounded-full bg-background border'
      alt='Coin icon'
    />

    <AnimatePresence>
      {networkIconUrl && (
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0 }}
          transition={{
            type: 'spring',
            stiffness: 120,
            damping: 14
          }}
          className='absolute -bottom-0.5 -right-0.5'
        >
          <img
            src={networkIconUrl}
            className='size-4.5 rounded-full border bg-background'
            alt='Network icon'
          />
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);
