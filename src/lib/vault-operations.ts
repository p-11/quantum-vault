import { ensurePresent } from '@/lib/assert';
import {
  getInterfaceAssets,
  getPositiveNonInterfaceAssetBalances,
  isNativeAsset
} from '@/lib/utils';
import {
  EvmAccountClient,
  formatUnits,
  type Asset,
  type BalanceResult,
  type EvmAddress,
  type GasCostEstimate,
  type PersistedAccount,
  type TransactionValue
} from '@project-eleven/libqc';

export type SummaryItem = {
  asset: Asset;
  balance: BalanceResult;
};

export type SummaryState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; items: SummaryItem[]; estimatedFee: string | null }
  | { status: 'unsupported-assets' }
  | { status: 'empty' }
  | { status: 'error' };

export type BitcoinWithdrawFeeEstimatingAccountClient = {
  estimateEmptyVaultFee(destinationAddress: string): Promise<bigint>;
};

type VaultOperationsAccountClient = {
  listAssets(): Promise<Array<Asset>>;
  getBalances(assets: Array<Asset>): Promise<Array<BalanceResult>>;
};

type VaultOperationsVault = {
  getAccount(
    accountId: PersistedAccount['id']
  ): Promise<VaultOperationsAccountClient>;
};

// Matches KERNEL_MAX_FEE_PER_GAS = parseGwei('0.001') in libqc
export const KERNEL_MAX_FEE_PER_GAS_WEI = 1_000_000n;

/**
 * Computes a conservative fee ceiling for an EVM vault-emptying operation.
 *
 * Sums all gas limit fields from the provided `GasCostEstimate`
 * (callGasLimit + preVerificationGas + verificationGasLimit +
 * paymasterVerificationGasLimit + paymasterPostOpGasLimit) and multiplies
 * the total by `KERNEL_MAX_FEE_PER_GAS_WEI`. The constant corresponds to
 * `KERNEL_MAX_FEE_PER_GAS = parseGwei('0.001')` in libqc, so the result
 * errs on the high side rather than under-estimating.
 */
export const computeFeeCost = (estimate: GasCostEstimate): bigint => {
  const units =
    estimate.callGasLimit +
    estimate.preVerificationGas +
    estimate.verificationGasLimit +
    (estimate.paymasterVerificationGasLimit ?? 0n) +
    (estimate.paymasterPostOpGasLimit ?? 0n);
  return KERNEL_MAX_FEE_PER_GAS_WEI * units;
};

export const hasBitcoinWithdrawFeeEstimateCapability = (
  accountClient: unknown
): accountClient is BitcoinWithdrawFeeEstimatingAccountClient =>
  typeof accountClient === 'object' &&
  accountClient !== null &&
  'estimateEmptyVaultFee' in accountClient &&
  typeof accountClient.estimateEmptyVaultFee === 'function';

export class NonInterfaceAssetBalanceError extends Error {
  constructor() {
    super('Unsupported token balances cannot be withdrawn in this version.');
    this.name = 'NonInterfaceAssetBalanceError';
  }
}

const getBalancesForAssets = ({
  assets,
  balances
}: {
  assets: ReadonlyArray<Asset>;
  balances: ReadonlyArray<BalanceResult>;
}): Array<BalanceResult> => {
  const balanceBySymbol = new Map(
    balances.map(balance => [balance.symbol, balance])
  );

  return assets.map(asset =>
    ensurePresent(
      balanceBySymbol.get(asset.symbol),
      `balance for ${asset.symbol}`
    )
  );
};

export const assertNoNonInterfaceAssetBalances = async (
  vault: VaultOperationsVault,
  account: PersistedAccount
): Promise<void> => {
  const accountClient = await vault.getAccount(account.id);
  const trackedAssets = await accountClient.listAssets();
  const trackedBalances = await accountClient.getBalances(trackedAssets);
  const nonInterfaceBalances = getPositiveNonInterfaceAssetBalances({
    assets: trackedAssets,
    balances: trackedBalances
  });

  if (nonInterfaceBalances.length > 0) {
    throw new NonInterfaceAssetBalanceError();
  }
};

/**
 * Loads a summary of the assets that would be swept when emptying a vault,
 * together with an estimated fee for the operation.
 *
 * @param vault - The `LibQC` instance used to resolve the account client.
 * @param account - The persisted account whose assets are being summarised.
 * @param destination - The destination address that assets will be swept to;
 *   used for fee estimation on chains that require a destination to estimate.
 * @returns A `SummaryState` in one of the following terminal statuses:
 *   - `'empty'` — the account has no assets with a non-zero balance.
 *   - `'ready'` — assets were found; `estimatedFee` is a human-readable fee
 *     string, or `null` when estimation fails or is unsupported for the chain.
 *   - `'error'` — the asset or balance fetch itself failed.
 */
export const loadVaultWithdrawSummary = async (
  vault: VaultOperationsVault,
  account: PersistedAccount,
  destination: string
): Promise<SummaryState> => {
  const accountClient = await vault.getAccount(account.id);
  const trackedAssets = await accountClient.listAssets();
  const trackedBalances = await accountClient.getBalances(trackedAssets);
  const nonInterfaceBalances = getPositiveNonInterfaceAssetBalances({
    assets: trackedAssets,
    balances: trackedBalances
  });

  if (nonInterfaceBalances.length > 0) {
    return { status: 'unsupported-assets' };
  }

  const assets = getInterfaceAssets(trackedAssets);
  const balances = getBalancesForAssets({
    assets,
    balances: trackedBalances
  });
  const items: SummaryItem[] = assets
    .map((asset, index) => ({ asset, balance: balances[index] }))
    .filter(({ balance }) => balance.balance > 0n);

  if (items.length === 0) {
    return { status: 'empty' };
  }

  let estimatedFee: string | null = null;
  const nativeItem = items.find(({ asset }) => isNativeAsset(asset));
  if (nativeItem && accountClient instanceof EvmAccountClient) {
    try {
      const estimate = await accountClient.getTransferGasCostEstimate(
        1n as TransactionValue,
        destination as EvmAddress
      );
      const perOpFee = computeFeeCost(estimate);
      // Rough overestimate: assumes each asset costs the same as the native transfer.
      // ERC-20 transfers are typically cheaper, but this errs on the safe side.
      const totalFee = perOpFee * BigInt(items.length);
      const { symbol } = nativeItem.asset;
      estimatedFee = `~${formatUnits(totalFee, nativeItem.asset.decimals)} ${symbol}`;
    } catch (error) {
      console.error('Failed to estimate EVM withdrawal fee:', error);
      estimatedFee = null;
    }
  } else if (
    nativeItem &&
    hasBitcoinWithdrawFeeEstimateCapability(accountClient)
  ) {
    try {
      const fee = await accountClient.estimateEmptyVaultFee(destination);
      estimatedFee = `~${formatUnits(fee, nativeItem.asset.decimals)} ${nativeItem.asset.symbol}`;
    } catch (error) {
      console.error('Failed to estimate Bitcoin withdrawal fee:', error);
      estimatedFee = null;
    }
  }

  return { status: 'ready', items, estimatedFee };
};
