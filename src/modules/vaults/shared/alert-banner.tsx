import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import type { AlertTone } from '../types';
import { WarningCircleIcon } from './icons';

export type AlertBannerLine = {
  id: string;
  text: string;
};

type AlertBannerProps = {
  tone: AlertTone;
  title?: string;
  lines: ReadonlyArray<AlertBannerLine>;
  /** Pull the edges out to the popup width when the parent has horizontal padding. */
  fullBleed?: boolean;
  className?: string;
  /**
   * When provided, renders a close button on the trailing edge of the
   * banner. The caller is responsible for clearing whatever upstream
   * state caused the banner to render.
   */
  onDismiss?: () => void;
  dismissAriaLabel?: string;
  dismissButtonTestId?: string;
} & HTMLAttributes<HTMLDivElement>;

const toneToClassName: Record<
  AlertTone,
  {
    container: string;
    icon: string;
    title: string;
    body: string;
  }
> = {
  danger: {
    container: 'border-y border-destructive bg-destructive/10',
    icon: 'text-destructive',
    title: 'text-destructive',
    body: 'text-destructive'
  },
  warning: {
    container: 'border-y border-warning bg-warning/10',
    icon: 'text-warning',
    title: 'text-warning',
    body: 'text-warning'
  }
};

/**
 * Reusable alert strip that mirrors the Figma Alert component (38:4737).
 *
 * Used on:
 *  - Home alerts state (44:12930) - vulnerable vault count + per-vault lines.
 *  - Vault Detail vulnerable banner (32:1597).
 *  - Vault Detail pending/sent banners (43:4152, 44:3776, 44:8676, 44:8696).
 *
 * Tone controls fill + stroke color. Body lines render one per line; an
 * empty `lines` array hides the body region entirely.
 */
export const AlertBanner = ({
  tone,
  title,
  lines,
  fullBleed = false,
  className,
  onDismiss,
  dismissAriaLabel = 'Dismiss',
  dismissButtonTestId,
  ...props
}: AlertBannerProps) => {
  const toneClasses = toneToClassName[tone];

  return (
    <div
      {...props}
      role='alert'
      aria-live='assertive'
      aria-atomic='true'
      className={cn(
        'flex items-start gap-2 px-2.5 py-2',
        fullBleed && '-mx-4',
        toneClasses.container,
        className
      )}
    >
      <div className='pt-0.5'>
        <WarningCircleIcon className={cn('shrink-0', toneClasses.icon)} />
      </div>
      <div className='min-w-0 flex-1 space-y-0.5'>
        {title ? (
          <p className={cn('type-label truncate', toneClasses.title)}>
            {title}
          </p>
        ) : null}
        {lines.map(line => (
          <p key={line.id} className={cn('type-body-sm', toneClasses.body)}>
            {line.text}
          </p>
        ))}
      </div>
      {onDismiss ? (
        <button
          type='button'
          aria-label={dismissAriaLabel}
          data-testid={dismissButtonTestId}
          onClick={onDismiss}
          className={cn(
            'shrink-0 self-start rounded-sm p-0.5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
            toneClasses.icon
          )}
        >
          <X className='size-4' aria-hidden='true' />
        </button>
      ) : null}
    </div>
  );
};
