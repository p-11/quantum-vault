import { AlertTriangleIcon } from 'lucide-react';
import { useEffect } from 'react';
import { Screen } from './screen';

type BootErrorScreenProps = { error: Error };

/**
 * Rendered by `WalletProvider`'s boot gate when LibQC construction
 * fails. The error message comes from `requireEnv` and names the
 * missing environment variable. No retry button - the failure is
 * configuration-level and the recovery path is to fix the .env file
 * (or repo secrets) and reload the extension.
 *
 * The `#boot-shell` removal here mirrors `ScreenProvider`'s post-hydration
 * cleanup. Without this, the static skeleton in `index.html` fades in via
 * its CSS animation (650ms in dev, 280ms in production) and covers the
 * error message, leaving the user with a permanent loading skeleton and
 * no indication of what went wrong.
 */
export function BootErrorScreen({ error }: BootErrorScreenProps) {
  useEffect(() => {
    const bootShellElement = document.getElementById('boot-shell');
    if (!bootShellElement) return;
    bootShellElement.dataset.state = 'hidden';
    bootShellElement.remove();
  }, []);

  return (
    <Screen>
      <div className='flex gap-3.5'>
        <AlertTriangleIcon size={52} strokeWidth={0.8} />
        <div>
          <h1 className='text-[1.3rem]'>Configuration error</h1>
          <p className='text-[0.85rem]'>Quantum Vault could not start.</p>
        </div>
      </div>

      <div className='mt-8 mb-9 bg-secondary p-4 rounded-md'>
        <p className='text-sm font-mono break-words'>{error.message}</p>
      </div>

      <p className='text-muted-foreground text-xs'>
        Set the missing environment variable in your <code>.env</code> file (or
        the repository secrets if this is a CI build), then reload the
        extension. See the README for setup instructions.
      </p>
    </Screen>
  );
}
