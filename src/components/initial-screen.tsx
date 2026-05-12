import { QuantumVaultMark } from '@/components/shared/quantum-vault-mark';
import { useScreen } from '@/hooks/use-screen';

import { Screen } from './screen';
import { Button } from './ui/button';

export const InitialScreen = () => {
  const { navigate } = useScreen();

  return (
    <Screen className='sharp pt-8'>
      <div className='flex flex-1 flex-col justify-between'>
        <div className='flex flex-col gap-8 text-foreground'>
          <QuantumVaultMark className='h-[37.6px] w-20' />
          <h1 className='type-display'>Quantum Vault</h1>
        </div>

        <div className='flex flex-col gap-8'>
          <div className='flex flex-col gap-4'>
            <Button size='flow' onClick={() => navigate('wallet-creation')}>
              Create a Vault Account
            </Button>
            <Button size='flow' onClick={() => navigate('wallet-recovery')}>
              Recover a Vault Account
            </Button>
          </div>
          <p className='text-footer-muted text-center text-xs leading-none'>
            &copy; PROJECT ELEVEN
          </p>
        </div>
      </div>
    </Screen>
  );
};
