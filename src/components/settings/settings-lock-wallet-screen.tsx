import { useScreen } from '@/hooks/use-screen';
import { useWallet } from '@/hooks/use-wallet';
import { Button } from '@/components/ui/button';

import { SettingsPage } from './settings-page';

export const SettingsLockWalletScreen = () => {
  const { navigate } = useScreen();
  const { clearWalletState } = useWallet();

  const lockWallet = () => {
    clearWalletState();
    navigate('lock', { direction: 'back', type: 'fade' });
  };

  return (
    <SettingsPage
      title='Lock Wallet'
      onBack={() => navigate('settings', { direction: 'back' })}
      footer={
        <>
          <Button
            size='flow'
            onClick={lockWallet}
            data-testid='confirm-lock-wallet-button'
          >
            LOCK NOW
          </Button>
          <Button
            size='flow'
            variant='secondary'
            onClick={() => navigate('settings', { direction: 'back' })}
          >
            BACK
          </Button>
        </>
      }
    >
      <div className='px-4 pt-5 text-base font-normal leading-normal text-foreground'>
        <p>
          Locking your wallet will require your password to access it again.
        </p>
        <p className='mt-8'>All background processes will continue.</p>
      </div>
    </SettingsPage>
  );
};
