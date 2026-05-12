import { AssetCard } from '@/components/asset-card';
import { CurrencyValueText } from '@/components/currency/currency-value-text';
import { Skeleton } from '@/components/ui/skeleton';
import { useScreen } from '@/hooks/use-screen';
import { useWallet } from '@/hooks/use-wallet';
import { toastMessages } from '@/lib/content';
import { formatAssetBalance, shortenAddress } from '@/lib/utils';
import { useCurrency } from '@/hooks/use-currency';
import {
  resolveQueryErrorCategory,
  resolveQueryErrorMessage
} from '@/modules/vaults/data/query-error-message';
import { useAccountDataQuery } from '@/modules/vaults/data/queries';
import {
  isNativeActivity,
  type NativeActivity
} from '@/modules/vaults/data/mappers/activity';
import { resolveAssetIconUrl } from '@/modules/vaults/shared/asset-icon';
import {
  CopyIcon,
  HandCoinsIcon,
  Loader2Icon,
  SettingsIcon
} from 'lucide-react';
import { Fragment, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CoinIcon } from './coin-icon';
import { Modal } from './modal';
import { Screen } from './screen';
import { BackButton } from './ui/back-button';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { MatchQuery } from './ui/match-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

export const AccountScreen = () => {
  const { navigate } = useScreen();
  const { currency } = useCurrency();

  const { selectedAccount, sessionId, vault, clearWalletState } = useWallet();

  const [showReceiveModal, setShowReceiveModal] = useState(false);

  const accountDataQuery = useAccountDataQuery({
    currency,
    selectedAccount,
    sessionId,
    vault
  });

  useEffect(() => {
    if (!accountDataQuery.isError || accountDataQuery.isFetching) return;

    const errorCategory = resolveQueryErrorCategory(accountDataQuery.error);
    toast.error(resolveQueryErrorMessage(accountDataQuery.error));

    if (errorCategory === 'vaultState') {
      clearWalletState();
      navigate('lock', { direction: 'back', type: 'fade' });
      return;
    }

    navigate('home', { direction: 'back' });
  }, [
    clearWalletState,
    accountDataQuery.error,
    accountDataQuery.isError,
    accountDataQuery.isFetching,
    navigate
  ]);

  const copyAddressToClipboard = () => {
    if (!selectedAccount) return;

    navigator.clipboard.writeText(selectedAccount.address);

    toast.success(toastMessages.copiedToClipboard);
  };

  if (!selectedAccount) return null;

  return (
    <>
      <Screen>
        <div className='relative flex gap-6 items-center -mt-3 justify-between'>
          <BackButton onClick={() => navigate('home', { direction: 'back' })} />

          <div className='flex justify-center'>
            <p className='m-0 mt-1 mr-1 pointer-events-none'>
              {shortenAddress(selectedAccount.address)}
            </p>
            <Button
              size='icon-sm'
              variant='ghost'
              onClick={copyAddressToClipboard}
            >
              <CopyIcon className='size-4' />
            </Button>
          </div>

          <Button
            data-testid='account-settings'
            className='relative -mr-2'
            size='icon-sm'
            variant='ghost'
            onClick={() => {
              // TODO: implement settings
            }}
          >
            <SettingsIcon />
          </Button>
        </div>

        <div className='flex flex-col gap-2 items-center mt-4'>
          <p className='text-base mt-2'>
            <MatchQuery
              value={accountDataQuery}
              loading={() => <Skeleton className='h-[24px] w-20' />}
              success={accountData => (
                <CurrencyValueText
                  value={accountData.totalCurrencyValue}
                  currency={currency}
                />
              )}
            />
          </p>
        </div>

        <div className='flex gap-4 mt-4 mb-8'>
          <Button
            className='pl-2 gap-0.5 flex-col h-auto py-3 flex-1'
            size='sm'
            variant='secondary'
            onClick={() => setShowReceiveModal(true)}
          >
            <HandCoinsIcon />
            Receive
          </Button>
        </div>

        <Tabs defaultValue='funds'>
          <TabsList className='w-full'>
            <TabsTrigger value='funds'>Funds</TabsTrigger>

            <TabsTrigger value='activity'>Activity</TabsTrigger>
          </TabsList>

          <TabsContent value='funds'>
            <div>
              <MatchQuery
                value={accountDataQuery}
                loading={() => (
                  <div className='flex flex-col gap-2 justify-center mt-4'>
                    <Skeleton className='h-[73px] w-full' />
                    <Skeleton className='h-[73px] w-full' />
                  </div>
                )}
                success={accountData =>
                  accountData.assets.map(asset => (
                    <AssetCard
                      key={asset.symbol}
                      asset={asset}
                      balances={accountData.balances}
                      className='group'
                    />
                  ))
                }
              />
            </div>
          </TabsContent>

          <TabsContent value='activity'>
            <MatchQuery
              value={accountDataQuery}
              loading={() => (
                <div className='flex justify-center mt-4'>
                  <Loader2Icon className='animate-spin' />
                </div>
              )}
              success={accountData => {
                const activities =
                  accountData.activities.filter(isNativeActivity);

                return (
                  <>
                    {!activities.length && (
                      <div>
                        <p className='text-muted-foreground text-center mt-4'>
                          No activity
                        </p>
                      </div>
                    )}

                    <div>
                      {activities.map((activity, i) => {
                        const previousActivity = activities[i - 1];
                        const showHeader =
                          previousActivity === undefined ||
                          activity.blockNumber !== previousActivity.blockNumber;
                        const activityKey = getActivityKey({
                          activity,
                          index: i
                        });

                        return (
                          <Fragment key={activityKey}>
                            {showHeader && (
                              <div className='mt-4'>
                                <p className='text-muted-foreground'>
                                  Block: {activity.blockNumber.toString()}
                                </p>
                              </div>
                            )}

                            <ActivityCard activity={activity} />
                          </Fragment>
                        );
                      })}
                    </div>
                  </>
                );
              }}
            />
          </TabsContent>
        </Tabs>
      </Screen>

      <Modal
        show={showReceiveModal}
        onDismiss={() => setShowReceiveModal(false)}
      >
        <div className='p-6'>
          <p className='font-medium text-center'>Receive</p>

          <Card className='mb-1.5 bg-secondary'>
            <CardContent>
              <p className='text-sm break-all text-center'>
                {selectedAccount.address}
              </p>
            </CardContent>
          </Card>

          <div className='flex justify-center'>
            <Button
              size='sm'
              variant='ghost'
              onClick={copyAddressToClipboard}
              className='text-sm h-7 px-2'
            >
              <CopyIcon className='size-4' /> Copy to clipboard
            </Button>
          </div>
          <Button
            onClick={() => setShowReceiveModal(false)}
            variant='outline'
            size='sm'
            className='w-full mt-6'
          >
            Done
          </Button>
        </div>
      </Modal>
    </>
  );
};

const ActivityCard = ({ activity }: { activity: NativeActivity }) => {
  const { selectedAccount, assets } = useWallet();

  if (!selectedAccount) return null;

  const asset = assets.find(a =>
    a.entities.some(
      e => e.assetType.chainId.reference === selectedAccount.chainId.reference
    )
  );

  if (!asset) return null;

  const isReceived =
    activity.data.to.toLowerCase() === selectedAccount.address.toLowerCase();

  return (
    <div className='flex w-full h-auto gap-3 items-center text-left my-2 flex-row py-3.5 relative group border-t'>
      <CoinIcon
        iconUrl={resolveAssetIconUrl({
          asset,
          chainIconUrl: null
        })}
      />

      <div className='flex flex-col flex-1'>
        <div className='flex justify-between'>
          <p>{isReceived ? 'Received' : 'Sent'}</p>

          <p>
            {isReceived ? '+' : '-'}
            {formatAssetBalance(activity.data.value, asset)}
          </p>
        </div>

        <div className='flex justify-between'>
          <p className='text-muted-foreground text-sm'>
            {isReceived
              ? `From ${shortenAddress(activity.data.from)}`
              : `To ${shortenAddress(activity.data.to)}`}
          </p>

          <p className='text-muted-foreground text-sm'>{asset.symbol}</p>
        </div>
      </div>
    </div>
  );
};

const getActivityKey = ({
  activity,
  index
}: {
  activity: NativeActivity;
  index: number;
}) =>
  [
    activity.type,
    activity.blockNumber.toString(),
    activity.data.from.toLowerCase(),
    activity.data.to.toLowerCase(),
    activity.data.value.toString(),
    index.toString()
  ].join(':');
