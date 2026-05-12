import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { useWallet } from '@/hooks/use-wallet';
import { toastMessages } from '@/lib/content';
import { runSingleFlight } from '@/lib/single-flight';

import { executeManualBalanceRefresh } from './manual-balance-refresh';

export const useManualBalanceRefresh = () => {
  const { refreshBalances } = useWallet();
  const [isRefreshingBalances, setIsRefreshingBalances] = useState(false);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);

  const refreshBalancesManually = () => {
    const refreshRequest = runSingleFlight({
      inFlightRef: refreshInFlightRef,
      action: () =>
        executeManualBalanceRefresh({
          refreshBalances,
          onRefreshStart: () => setIsRefreshingBalances(true),
          onRefreshSuccess: () =>
            toast.success(toastMessages.balanceRefreshSuccess),
          onRefreshError: () => toast.error(toastMessages.balanceRefreshFailed),
          onRefreshComplete: () => setIsRefreshingBalances(false)
        })
    });

    if (refreshRequest === null) {
      toast(toastMessages.balanceRefreshInProgress);
    }
  };

  return {
    isRefreshingBalances,
    refreshBalancesManually
  };
};
