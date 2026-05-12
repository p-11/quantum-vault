import { QuantumVaultMark } from '@/components/shared/quantum-vault-mark';
import { Button } from '@/components/ui/button';
import { useClickGate } from '@/hooks/use-click-gate';
import { useEffect } from 'react';

import { walletCreationStepContainerClassName } from '../core';

type SuccessStepProps = {
  onContinue: () => void;
  onReady: () => void;
};

export const SuccessStep = ({ onContinue, onReady }: SuccessStepProps) => {
  useEffect(() => {
    onReady();
  }, [onReady]);

  const gatedContinue = useClickGate({ handler: onContinue });

  return (
    <div className={walletCreationStepContainerClassName}>
      <div className='flex flex-col gap-4'>
        <div className='flex flex-col gap-8 text-foreground'>
          <QuantumVaultMark className='h-[37.6px] w-20' />
          <h1 className='type-heading-xl'>Quantum Vault Created</h1>
        </div>
        <p className='text-footer-muted text-base leading-normal'>
          Quantum Vault is ready. Keep your recovery phrase safe - it's the only
          way to restore access.
        </p>
      </div>

      <div className='flex flex-col gap-8'>
        <Button size='flow' onClick={gatedContinue} data-testid='open-vault'>
          Open Vault
        </Button>
        <p className='text-footer-muted text-center text-xs leading-none'>
          &copy; PROJECT ELEVEN
        </p>
      </div>
    </div>
  );
};
