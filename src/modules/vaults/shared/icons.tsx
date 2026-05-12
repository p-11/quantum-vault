import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

type SvgProps = ComponentPropsWithoutRef<'svg'>;

/**
 * Settings gear - Figma header right slot (31:7140).
 */
export const SettingsGearIcon = (props: SvgProps) => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    width='24'
    height='24'
    viewBox='0 0 24 24'
    fill='none'
    className='size-6 text-foreground'
    {...props}
  >
    <path
      d='M12 15.75C14.0711 15.75 15.75 14.0711 15.75 12C15.75 9.92893 14.0711 8.25 12 8.25C9.92893 8.25 8.24999 9.92893 8.24999 12C8.24999 14.0711 9.92893 15.75 12 15.75Z'
      stroke='currentColor'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
    <path
      d='M12.1922 19.3228C12.0666 19.3228 11.94 19.3228 11.8172 19.3228L8.81249 21C7.6428 20.6065 6.55787 19.9959 5.61468 19.2L5.60343 15.825C5.53687 15.72 5.47406 15.6141 5.41593 15.5053L2.42812 13.8038C2.19278 12.6134 2.19278 11.3885 2.42812 10.1981L5.41312 8.50125C5.47406 8.39344 5.53687 8.28656 5.60062 8.18156L5.61562 4.80656C6.55796 4.00841 7.6426 3.39548 8.81249 3L11.8125 4.67719C11.9381 4.67719 12.0647 4.67719 12.1875 4.67719L15.1875 3C16.3572 3.39346 17.4421 4.00414 18.3853 4.8L18.3966 8.175C18.4631 8.28 18.5259 8.38594 18.5841 8.49469L21.57 10.1953C21.8053 11.3857 21.8053 12.6106 21.57 13.8009L18.585 15.4978C18.5241 15.6056 18.4612 15.7125 18.3975 15.8175L18.3825 19.1925C17.4408 19.9908 16.3568 20.604 15.1875 21L12.1922 19.3228Z'
      stroke='currentColor'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
  </svg>
);

/**
 * Alert warning circle - used by `AlertBanner` danger variant.
 */
export const WarningCircleIcon = ({ className, ...props }: SvgProps) => (
  <svg
    width='16'
    height='16'
    viewBox='0 0 16 16'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
    className={cn('size-4 shrink-0 text-destructive', className)}
    {...props}
  >
    <path
      d='M8 8.5V5M14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2C11.3137 2 14 4.68629 14 8Z'
      stroke='currentColor'
      strokeWidth='1.33'
      strokeLinecap='round'
    />
    <path
      d='M8 11.5C8.41421 11.5 8.75 11.1642 8.75 10.75C8.75 10.3358 8.41421 10 8 10C7.58579 10 7.25 10.3358 7.25 10.75C7.25 11.1642 7.58579 11.5 8 11.5Z'
      fill='currentColor'
    />
  </svg>
);

/**
 * Success check used inside the vault-success circle button (Figma 44:3776, 44:8696).
 */
export const SuccessCheckIcon = (props: SvgProps) => (
  <svg
    width='20'
    height='20'
    viewBox='0 0 20 20'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
    className='shrink-0'
    {...props}
  >
    <path
      d='M4 10L8.5 14.5L16 7'
      stroke='currentColor'
      strokeWidth='1.66'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
  </svg>
);

/**
 * Circle arrow down - deposit CTA icon on home (Figma 31:7140) + detail screens.
 */
export const DepositArrowIcon = (props: SvgProps) => (
  <svg
    width='16'
    height='16'
    viewBox='0 0 16 16'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
    className='shrink-0'
    {...props}
  >
    <path
      d='M8 3v10M8 13l-4-4M8 13l4-4'
      stroke='currentColor'
      strokeWidth='1.33'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
  </svg>
);

/**
 * Circle arrow left - withdraw CTA icon on home + detail screens.
 * Path copied from provided Figma-exported SVG.
 */
export const WithdrawArrowIcon = (props: SvgProps) => (
  <svg
    width='16'
    height='16'
    viewBox='0 0 16 16'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
    className='shrink-0'
    {...props}
  >
    <path
      d='M5.5 8H10.5M5.5 8L7.5 6M5.5 8L7.5 10M14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2C11.3137 2 14 4.68629 14 8Z'
      stroke='currentColor'
      strokeWidth='1.5'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
  </svg>
);
