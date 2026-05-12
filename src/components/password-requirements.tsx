import type { PasswordValidationResult } from '@project-eleven/libqc';
import { CheckCircleIcon, CircleIcon } from 'lucide-react';

type Props = {
  result: PasswordValidationResult;
};

const REQUIREMENTS: {
  id: keyof PasswordValidationResult['requirements'];
  label: string;
}[] = [
  { id: 'asciiOnly', label: 'Printable ASCII characters only' },
  { id: 'minLength', label: 'At least 8 characters' },
  { id: 'uppercase', label: 'At least one uppercase letter' },
  { id: 'lowercase', label: 'At least one lowercase letter' },
  { id: 'digit', label: 'At least one number' },
  { id: 'specialChar', label: 'At least one special character' }
];

export const PasswordRequirements = ({ result }: Props) => (
  <div className='flex flex-col gap-1.5 mt-3'>
    {REQUIREMENTS.map(({ id, label }) => {
      const met = result.requirements[id];
      return (
        <div
          key={id}
          className={`flex items-center gap-1.5 text-xs ${met ? 'text-success' : 'text-muted-foreground'}`}
        >
          {met ? (
            <CheckCircleIcon className='size-3 shrink-0' />
          ) : (
            <CircleIcon className='size-3 shrink-0' />
          )}
          <span>{label}</span>
        </div>
      );
    })}
  </div>
);
