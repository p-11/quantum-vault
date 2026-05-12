import { NoPasswordSetError, VaultCorruptedError } from '@project-eleven/libqc';
import { Loader2Icon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { PasswordRevealToggle } from '@/components/shared/password-reveal-toggle';
import { QuantumVaultMark } from '@/components/shared/quantum-vault-mark';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { useBoolean } from '@/hooks/use-boolean';
import { useScreen } from '@/hooks/use-screen';
import { useWallet } from '@/hooks/use-wallet';
import { attempt } from '@/lib/attempt';
import { toastMessages } from '@/lib/content';
import { match } from '@/lib/match';
import { toExistingVaultPasswordBytes } from '@/lib/password';
import { withZeroed } from '@/lib/secrets-zeroing';
import { clearSecretRef, replaceSecretRef, zeroOut } from '@/lib/utils';

import { Screen } from './screen';

const textEncoder = new TextEncoder();

export const LockScreen = () => {
  const { navigate } = useScreen();
  const { initWallet, vault, clearWalletState } = useWallet();
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<Uint8Array>(new Uint8Array());
  const [, setPasswordRevision] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordRevealed, passwordReveal] = useBoolean();

  const clearPassword = useCallback(() => {
    clearSecretRef(passwordRef);
    setPasswordRevision(revision => revision + 1);
  }, []);

  const setPassword = useCallback((password: string) => {
    replaceSecretRef(passwordRef, textEncoder.encode(password));
    setPasswordRevision(revision => revision + 1);
  }, []);

  const isSubmitDisabled = passwordRef.current.length === 0 || isLoading;

  const unlock = async () => {
    if (isLoading || passwordRef.current.length === 0) {
      return;
    }

    zeroOut(passwordInputRef);
    setIsLoading(true);
    const unlockResult = await attempt(async () => {
      const existingPassword = toExistingVaultPasswordBytes(
        passwordRef.current
      );
      await withZeroed(existingPassword, () => vault.unlock(existingPassword));
    });
    clearPassword();

    if ('error' in unlockResult) {
      setIsLoading(false);
      if (unlockResult.error instanceof NoPasswordSetError) {
        navigate('wallet-creation');
        return;
      }
      if (unlockResult.error instanceof VaultCorruptedError) {
        navigate('wallet-recovery');
        return;
      }
      toast.error(toastMessages.invalidPassword);
      return;
    }

    const initWalletResult = await attempt(() => initWallet());
    if ('error' in initWalletResult) {
      void clearWalletState();
      setIsLoading(false);
      toast.error(toastMessages.unexpectedError);
      return;
    }

    setIsLoading(false);
    match(initWalletResult.data, {
      ready: () => navigate('home', { type: 'fade' }),
      degraded: () => navigate('home', { type: 'fade' }),
      ignored: () => {
        void clearWalletState();
        toast.error(toastMessages.unexpectedError);
        navigate('lock', { type: 'fade' });
      }
    });
  };

  const handleRecoverClick = () => {
    if (isLoading) {
      return;
    }

    clearPassword();
    zeroOut(passwordInputRef);
    void clearWalletState();
    navigate('wallet-recovery');
  };

  useEffect(() => {
    return () => {
      zeroOut(passwordInputRef);
      clearPassword();
    };
  }, [clearPassword]);

  return (
    <Screen className='sharp'>
      <div className='flex flex-1 min-h-0 flex-col justify-between'>
        <div>
          <div className='flex flex-col gap-8 text-foreground'>
            <QuantumVaultMark className='h-[37.6px] w-20' />
            <div className='flex flex-col gap-3'>
              <h1 className='type-heading-lg'>Welcome Back</h1>
              <p className='type-body text-muted-foreground'>
                Enter your password to unlock
              </p>
            </div>
          </div>

          <div className='mt-8 flex flex-col gap-3'>
            <Field
              label='Password'
              type={isPasswordRevealed ? 'text' : 'password'}
              onChange={setPassword}
              placeholder='Enter your password'
              autoFocus
              autoComplete='current-password'
              inputRef={passwordInputRef}
              onSubmit={() => void unlock()}
              trailingAddon={
                <PasswordRevealToggle
                  isRevealed={isPasswordRevealed}
                  onToggle={passwordReveal.toggle}
                />
              }
            />
            <p className='type-body-sm text-muted-foreground'>
              Forgot password?{' '}
              <button
                type='button'
                onClick={handleRecoverClick}
                disabled={isLoading}
                className='underline underline-offset-2 transition-colors hover:text-muted-foreground/80 disabled:pointer-events-none disabled:opacity-50'
              >
                Use recovery phrase
              </button>
            </p>
          </div>
        </div>

        <div className='flex flex-col gap-4 pt-4'>
          <Button
            size='flow'
            onClick={() => void unlock()}
            disabled={isSubmitDisabled}
            data-testid='unlock-wallet-button'
          >
            {isLoading ? <Loader2Icon className='animate-spin' /> : 'Unlock'}
          </Button>
        </div>
      </div>
    </Screen>
  );
};
