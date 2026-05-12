import { describe, expect, it, vi } from 'vitest';

vi.mock('@project-eleven/libqc', () => ({
  ActivityType: {
    NativeTransaction: 'NativeTransaction',
    Erc20Transaction: 'Erc20Transaction',
    BitcoinTransaction: 'BitcoinTransaction'
  }
}));

import {
  ActivityType,
  type Activity,
  type BitcoinAddress,
  type BlockNumber,
  type EvmAddress,
  type TransactionValue
} from '@project-eleven/libqc';
import {
  getBitcoinAssetMetadata,
  getNativeAssetMetadata,
  isInterfaceActivity,
  mapActivityToRow
} from './activity';

const fixtureAssets = [
  {
    symbol: 'ETH',
    decimals: 18,
    entities: [
      {
        assetType: {
          assetName: {
            namespace: 'slip44',
            reference: '60'
          }
        }
      }
    ]
  },
  {
    symbol: 'BTC',
    decimals: 8,
    entities: [
      {
        assetType: {
          assetName: {
            namespace: 'slip44',
            reference: '0'
          }
        }
      }
    ]
  }
] as const;

const blockNumber = (value: bigint): BlockNumber => {
  if (value < 0n) {
    throw new Error('Block number must be non-negative');
  }

  return value as BlockNumber;
};

const transactionValue = (value: bigint): TransactionValue => {
  if (value < 0n) {
    throw new Error('Transaction value must be non-negative');
  }

  return value as TransactionValue;
};

const evmAddress = (value: `0x${string}`): EvmAddress => {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`Invalid EVM address fixture: ${value}`);
  }

  return value;
};

const bitcoinAddress = (value: string): BitcoinAddress => {
  if (value.trim().length === 0) {
    throw new Error('Bitcoin address fixture must be non-empty');
  }

  return value as BitcoinAddress;
};

const nativeActivity = ({
  block,
  from,
  to,
  value,
  txHash
}: {
  block: bigint;
  from: EvmAddress;
  to: EvmAddress;
  value: bigint;
  txHash: `0x${string}`;
}) =>
  ({
    type: ActivityType.NativeTransaction,
    blockNumber: blockNumber(block),
    data: {
      from,
      to,
      value: transactionValue(value),
      txHash,
      explorerUrl: null
    }
  }) satisfies Activity;

const erc20Activity = ({
  block,
  from,
  to,
  value,
  contract,
  txHash
}: {
  block: bigint;
  from: EvmAddress;
  to: EvmAddress;
  value: bigint;
  contract: EvmAddress;
  txHash: `0x${string}`;
}) =>
  ({
    type: ActivityType.Erc20Transaction,
    blockNumber: blockNumber(block),
    data: {
      from,
      to,
      value: transactionValue(value),
      contract,
      txHash,
      explorerUrl: null
    }
  }) satisfies Activity;

const bitcoinActivity = ({
  block,
  from,
  to,
  value,
  txid
}: {
  block: bigint;
  from: Array<BitcoinAddress>;
  to: BitcoinAddress;
  value: bigint;
  txid: string;
}) =>
  ({
    type: ActivityType.BitcoinTransaction,
    blockNumber: blockNumber(block),
    data: {
      from,
      to,
      value: transactionValue(value),
      txid,
      explorerUrl: null
    }
  }) satisfies Activity;

describe('activity mappers - asset metadata helpers', () => {
  const vaultAddress = evmAddress('0x1111111111111111111111111111111111111111');
  const counterpartyAddress = evmAddress(
    '0x2222222222222222222222222222222222222222'
  );
  const usdcContract = evmAddress('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48');
  const txHash =
    '0x95d0c0a9f7eb489ccb6d2e2d8af17a58fa2df04af745cc34eddf566f5f04789a';

  it('classifies interface activity types explicitly', () => {
    expect(
      isInterfaceActivity(
        nativeActivity({
          block: 1n,
          from: counterpartyAddress,
          to: vaultAddress,
          value: 1n,
          txHash
        })
      )
    ).toBe(true);
    expect(
      isInterfaceActivity(
        bitcoinActivity({
          block: 2n,
          from: [bitcoinAddress('bc1qsourceaddress')],
          to: bitcoinAddress('bc1qvaultaddress'),
          value: 1n,
          txid: 'btc-tx-id'
        })
      )
    ).toBe(true);
    expect(
      isInterfaceActivity(
        erc20Activity({
          block: 3n,
          from: counterpartyAddress,
          to: vaultAddress,
          value: 1n,
          contract: usdcContract,
          txHash
        })
      )
    ).toBe(false);
  });

  it('selects the native asset by namespace, not by list order', () => {
    const metadata = getNativeAssetMetadata(fixtureAssets);

    expect(metadata).toEqual({
      symbol: 'ETH',
      decimals: 18
    });
  });

  it('selects bitcoin metadata from the BTC asset entry', () => {
    const metadata = getBitcoinAssetMetadata(fixtureAssets);

    expect(metadata).toEqual({
      symbol: 'BTC',
      decimals: 8
    });
  });
});

describe('mapActivityToRow', () => {
  const vaultAddress = evmAddress('0x1111111111111111111111111111111111111111');
  const counterpartyAddress = evmAddress(
    '0x2222222222222222222222222222222222222222'
  );
  const txHash =
    '0x95d0c0a9f7eb489ccb6d2e2d8af17a58fa2df04af745cc34eddf566f5f04789a';

  it('maps inbound native activity to a deposit row', () => {
    const row = mapActivityToRow({
      activity: nativeActivity({
        block: 10n,
        from: counterpartyAddress,
        to: vaultAddress,
        value: 5_000_000_000_000_000_000n,
        txHash
      }),
      vaultAddress,
      assets: fixtureAssets,
      index: 0
    });

    expect(row).toMatchObject({
      id: 'native:10:0',
      direction: 'inbound',
      counterparty: counterpartyAddress,
      amount: 5_000_000_000_000_000_000n,
      symbol: 'ETH',
      decimals: 18,
      txRef: txHash,
      blockNumber: blockNumber(10n)
    });
  });

  it('maps outbound native activity to a withdrawal row', () => {
    const row = mapActivityToRow({
      activity: nativeActivity({
        block: 11n,
        from: vaultAddress,
        to: counterpartyAddress,
        value: 1_000_000_000_000_000_000n,
        txHash
      }),
      vaultAddress,
      assets: fixtureAssets,
      index: 1
    });

    expect(row).toMatchObject({
      id: 'native:11:1',
      direction: 'outbound',
      counterparty: counterpartyAddress,
      amount: 1_000_000_000_000_000_000n,
      symbol: 'ETH',
      decimals: 18,
      txRef: txHash,
      blockNumber: blockNumber(11n)
    });
  });

  it('maps Bitcoin activity using address membership for direction', () => {
    const row = mapActivityToRow({
      activity: bitcoinActivity({
        block: 14n,
        from: [bitcoinAddress('bc1qsourceaddress')],
        to: bitcoinAddress('bc1qvaultaddress'),
        value: 50_000n,
        txid: 'btc-tx-id'
      }),
      vaultAddress: 'bc1qvaultaddress',
      assets: fixtureAssets,
      index: 4
    });

    expect(row).toMatchObject({
      id: 'btc:btc-tx-id',
      direction: 'inbound',
      counterparty: 'bc1qsourceaddress',
      amount: 50_000n,
      symbol: 'BTC',
      decimals: 8,
      txRef: 'btc-tx-id',
      blockNumber: blockNumber(14n)
    });
  });

  it('maps Bitcoin activity from the vault address to a withdrawal row', () => {
    const row = mapActivityToRow({
      activity: bitcoinActivity({
        block: 15n,
        from: [
          bitcoinAddress('bc1qsourceaddress'),
          bitcoinAddress('bc1qvaultaddress')
        ],
        to: bitcoinAddress('bc1qrecipientaddress'),
        value: 25_000n,
        txid: 'btc-outbound-tx-id'
      }),
      vaultAddress: 'bc1qvaultaddress',
      assets: fixtureAssets,
      index: 5
    });

    expect(row).toMatchObject({
      id: 'btc:btc-outbound-tx-id',
      direction: 'outbound',
      counterparty: 'bc1qrecipientaddress',
      amount: 25_000n,
      symbol: 'BTC',
      decimals: 8,
      txRef: 'btc-outbound-tx-id',
      blockNumber: blockNumber(15n)
    });
  });
});
