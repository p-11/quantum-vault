import { cn } from '@/lib/utils';

import type { SettingsRowConfig } from './core';

type SettingsRowProps = SettingsRowConfig;

const rowToneClassNames: Record<
  NonNullable<SettingsRowConfig['tone']>,
  {
    iconTile: string;
    label: string;
    value: string;
  }
> = {
  default: {
    iconTile: 'bg-secondary text-foreground',
    label: 'text-foreground',
    value: 'text-selected-foreground'
  },
  destructive: {
    iconTile: 'bg-destructive/10 text-destructive',
    label: 'text-destructive',
    value: 'text-destructive'
  }
};

export const SettingsRow = ({
  label,
  icon: Icon,
  tone = 'default',
  value,
  testId,
  isLoading = false,
  disabled = false,
  onSelect
}: SettingsRowProps) => {
  const classNames = rowToneClassNames[tone];

  return (
    <button
      type='button'
      data-testid={testId}
      onClick={onSelect}
      disabled={disabled}
      className='flex h-[74px] w-full items-center gap-2 px-4 text-left transition-colors hover:bg-accent/40 disabled:pointer-events-none disabled:opacity-70'
    >
      <span
        className={cn(
          'flex size-[42px] shrink-0 items-center justify-center',
          classNames.iconTile
        )}
      >
        <Icon className={cn('size-5', isLoading && 'animate-spin')} />
      </span>

      <span
        className={cn(
          'min-w-0 flex-1 truncate text-base font-normal uppercase leading-6',
          classNames.label
        )}
      >
        {label}
      </span>

      {value && (
        <span
          className={cn(
            'shrink-0 text-xs font-normal uppercase leading-none',
            classNames.value
          )}
        >
          {value}
        </span>
      )}
    </button>
  );
};
