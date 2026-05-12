import { EyeIcon, EyeOffIcon } from 'lucide-react';

type PasswordRevealToggleProps = {
  isRevealed: boolean;
  onToggle: () => void;
  disabled?: boolean;
};

export const PasswordRevealToggle = ({
  isRevealed,
  onToggle,
  disabled = false
}: PasswordRevealToggleProps) => (
  <button
    type='button'
    onClick={onToggle}
    disabled={disabled}
    className='text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50'
    aria-label={isRevealed ? 'Hide password' : 'Show password'}
  >
    {isRevealed ? (
      <EyeOffIcon className='size-4' />
    ) : (
      <EyeIcon className='size-4' />
    )}
  </button>
);
