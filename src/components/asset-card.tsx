import { BalanceInCurrencyText } from '@/components/currency/balance-in-currency-text';
import { formatAssetBalance } from '@/lib/utils';
import { resolveAssetIconUrl } from '@/modules/vaults/shared/asset-icon';
import type { Asset, BalanceResult } from '@project-eleven/libqc';
import { CoinIcon } from './coin-icon';

export const AssetCard = ({
  asset,
  balances,
  className
}: {
  asset: Asset;
  balances: Array<BalanceResult>;
  className?: string;
}) => {
  const assetBalance =
    balances.find(item => item.symbol === asset.symbol)?.balance ?? 0n;

  return (
    <div
      className={`flex w-full h-auto gap-2 items-center text-left my-2 justify-between flex-row py-3.5 relative border-b last:border-b-0${className ? ` ${className}` : ''}`}
    >
      <div className='flex gap-3 items-center'>
        <CoinIcon
          iconUrl={resolveAssetIconUrl({
            asset,
            chainIconUrl: null
          })}
        />

        <div className='flex flex-col gap-0.5'>
          <p>{asset.name}</p>
          <p className='text-muted-foreground'>{asset.symbol}</p>
        </div>
      </div>

      <div className='flex flex-col items-end gap-0.5'>
        <BalanceInCurrencyText balance={assetBalance} asset={asset} />
        <p className='text-muted-foreground'>
          {formatAssetBalance(assetBalance, asset)}
        </p>
      </div>
    </div>
  );
};
