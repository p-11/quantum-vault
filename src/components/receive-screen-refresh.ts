import { attempt } from '@/lib/attempt';

type ReceiveScreenRefreshInput = {
  refreshBalances(): Promise<void>;
  onRefreshError(): void;
};

export const refreshBalancesOnReceiveExit = async ({
  refreshBalances,
  onRefreshError
}: ReceiveScreenRefreshInput): Promise<void> => {
  const refreshResult = await attempt(refreshBalances);

  if ('error' in refreshResult) {
    onRefreshError();
  }
};
