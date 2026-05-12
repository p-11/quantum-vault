import type { Asset } from '@project-eleven/libqc';

const canonicalEthereumIconUrl =
  'https://assets.coingecko.com/asset_platforms/images/279/large/ethereum.png';

const shouldUseChainIcon = (assetSymbol: string): boolean =>
  assetSymbol === 'ETH' || assetSymbol === 'stETH';

export const resolveAssetIconUrl = ({
  asset,
  chainIconUrl
}: {
  asset: Pick<Asset, 'iconUrl' | 'symbol'>;
  chainIconUrl: string | null;
}): string =>
  shouldUseChainIcon(asset.symbol)
    ? (chainIconUrl ?? canonicalEthereumIconUrl)
    : asset.iconUrl;
