import { attempt } from '@/lib/attempt';

type ManualBalanceRefreshInput = {
  refreshBalances(): Promise<void>;
  onRefreshStart(): void;
  onRefreshSuccess(): void;
  onRefreshError(): void;
  onRefreshComplete(): void;
};

export const executeManualBalanceRefresh = async ({
  refreshBalances,
  onRefreshStart,
  onRefreshSuccess,
  onRefreshError,
  onRefreshComplete
}: ManualBalanceRefreshInput): Promise<void> => {
  onRefreshStart();

  const refreshResult = await attempt(refreshBalances);

  onRefreshComplete();

  if ('error' in refreshResult) {
    onRefreshError();
    return;
  }

  onRefreshSuccess();
};
