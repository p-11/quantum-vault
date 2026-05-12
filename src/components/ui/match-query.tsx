import { ensurePresent } from '@/lib/assert';
import { match } from '@/lib/match';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';

type MatchQueryProps<TData, TError> = {
  value: UseQueryResult<TData, TError>;
  loading(): ReactNode;
  success(data: TData): ReactNode;
  error?(): ReactNode;
};

export const MatchQuery = <TData, TError>({
  value,
  loading,
  success,
  error
}: MatchQueryProps<TData, TError>) =>
  match(value.status, {
    pending: loading,
    error: () => error?.() ?? null,
    success: () => success(ensurePresent(value.data, 'query.data'))
  });
