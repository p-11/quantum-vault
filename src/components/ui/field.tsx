import type { HTMLInputAutoCompleteAttribute, ReactNode, Ref } from 'react';
import { useId } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type FieldInput = {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'password';
  error?: string;
  trailingAddon?: ReactNode;
  autoFocus?: boolean;
  autoComplete?: HTMLInputAutoCompleteAttribute;
  onSubmit?: () => void;
  onBlur?: () => void;
  onFocus?: () => void;
  inputRef?: Ref<HTMLInputElement>;
  disabled?: boolean;
};

export const Field = ({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  error,
  trailingAddon,
  autoFocus = false,
  autoComplete,
  onSubmit,
  onBlur,
  onFocus,
  inputRef,
  disabled = false
}: FieldInput) => {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className='flex flex-col gap-2'>
      <Label htmlFor={id} className='text-foreground'>
        {label}
      </Label>
      <div className='relative'>
        <Input
          ref={inputRef}
          id={id}
          type={type}
          {...(value === undefined ? {} : { value })}
          onChange={event => onChange(event.target.value)}
          onKeyDown={
            onSubmit
              ? event => {
                  if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
                    return;
                  }
                  event.preventDefault();
                  onSubmit();
                }
              : undefined
          }
          placeholder={placeholder}
          onBlur={onBlur}
          onFocus={onFocus}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          autoCorrect='off'
          autoCapitalize='none'
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(trailingAddon && 'pr-9')}
        />
        {trailingAddon && (
          <div className='pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-muted-foreground [&>*]:pointer-events-auto'>
            {trailingAddon}
          </div>
        )}
      </div>
      {error && (
        <p id={errorId} className='text-sm text-input-error'>
          {error}
        </p>
      )}
    </div>
  );
};
