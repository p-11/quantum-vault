import { Loader2Icon } from 'lucide-react';

type CreatingWalletLoaderProps = {
  message?: string;
};

export const CreatingWalletLoader = ({
  message = 'Creating your vault...'
}: CreatingWalletLoaderProps) => (
  <div className='flex flex-1 flex-col items-center justify-center gap-4'>
    <Loader2Icon className='size-10 animate-spin text-muted-foreground' />
    <p className='text-muted-foreground'>{message}</p>
  </div>
);
