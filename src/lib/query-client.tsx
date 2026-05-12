import {
  QueryClient,
  QueryClientProvider,
  type QueryClientConfig
} from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';

const maxRetryAttempts = 1;

const getErrorStatusCode = (error: unknown): number | null => {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  if (!('status' in error)) {
    return null;
  }

  const { status } = error;
  return typeof status === 'number' ? status : null;
};

const shouldRetryQuery = (failureCount: number, error: unknown): boolean => {
  if (failureCount >= maxRetryAttempts) {
    return false;
  }

  const statusCode = getErrorStatusCode(error);
  if (statusCode !== null && statusCode >= 400 && statusCode < 500) {
    return false;
  }

  return true;
};

const queryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: shouldRetryQuery
    }
  }
};

const createQueryClient = (): QueryClient => new QueryClient(queryClientConfig);

const queryClient = createQueryClient();

export const QueryProvider = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);
