import { convertDuration } from '@/lib/time';

/**
 * Source of truth for the idle lock window. Exported for the
 * `useSessionTimeout` hook. Keep lock duration logic centralized here.
 */
export const sessionTimeoutMinutes = 10;

export const sessionTimeoutMs = convertDuration(
  sessionTimeoutMinutes,
  'min',
  'ms'
);
