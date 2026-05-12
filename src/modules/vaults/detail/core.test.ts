import type { ActivityRow } from '@/modules/vaults/data/mappers/activity';

vi.mock('@project-eleven/libqc', () => ({
  ActivityType: {
    BitcoinTransaction: 'BitcoinTransaction',
    Erc20Transaction: 'Erc20Transaction',
    NativeTransaction: 'NativeTransaction'
  },
  formatUnits: () => '0'
}));

import {
  getVaultAddressLookupKey,
  getVaultLabelByLookupKey,
  resolveLifecycleDestinationAddress,
  getLifecycleDestinationAddress,
  getLifecyclePrimaryTxRef,
  getLatestOutboundActivity,
  isRecordlessWithdrawnLifecycle,
  resolveWithdrawnActivityFallbackMetadata,
  getTxExplorerMetadataFromRef,
  getTxUrlFromRef,
  resolveActivityDateLabel,
  resolveLifecycleDestinationLabel,
  resolveLifecycleTxRef,
  resolveSuccessStateIconKind,
  resolveWithdrawAvailability,
  withdrawNativeBalanceThresholdByNamespace
} from './core';

const evmChainReference = '1';
const evmChainNamespace = 'eip155';
const bitcoinChainReference = '000000000019d6689c085ae165831e93';
const bitcoinChainNamespace = 'bip122';
const lifecycleTimestamp = 1_710_000_000_000;
const evmAddress = '0x1111111111111111111111111111111111111111';
const evmTxRef =
  '0x95d0c0a9f7eb489ccb6d2e2d8af17a58fa2df04af745cc34eddf566f5f04789a';
const secondaryEvmTxRef =
  '0xa5d0c0a9f7eb489ccb6d2e2d8af17a58fa2df04af745cc34eddf566f5f04789a';
const fallbackTxRef =
  '0x85d0c0a9f7eb489ccb6d2e2d8af17a58fa2df04af745cc34eddf566f5f04789a';
const withdrawDisabledMessageByNamespace = {
  [evmChainNamespace]: 'Leave at least 0.001 ETH available to withdraw.',
  [bitcoinChainNamespace]: 'Leave at least 900 sats available to withdraw.'
} satisfies Parameters<
  typeof resolveWithdrawAvailability
>[0]['disabledMessageByNamespace'];
const createWithdrawAssets = ({
  nativeSymbol,
  nativeSlip44Reference
}: {
  nativeSymbol: string;
  nativeSlip44Reference: string;
}) =>
  [
    {
      symbol: 'USDC',
      decimals: 6,
      entities: [
        {
          assetType: {
            assetName: {
              namespace: 'erc20',
              reference: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
            }
          }
        }
      ]
    },
    {
      symbol: nativeSymbol,
      decimals: 18,
      entities: [
        {
          assetType: {
            assetName: {
              namespace: 'slip44',
              reference: nativeSlip44Reference
            }
          }
        }
      ]
    }
  ] satisfies Parameters<typeof resolveWithdrawAvailability>[0]['assets'];

const createWithdrawBalances = ({
  nativeSymbol,
  nativeBalance
}: {
  nativeSymbol: string;
  nativeBalance: bigint;
}) =>
  [
    {
      symbol: 'USDC',
      balance: 5_000_000n
    },
    {
      symbol: nativeSymbol,
      balance: nativeBalance
    }
  ] satisfies Parameters<typeof resolveWithdrawAvailability>[0]['balances'];

const createActivityRow = (
  overrides: Partial<ActivityRow> = {}
): ActivityRow => ({
  id: 'activity-1',
  direction: 'inbound',
  counterparty: '0x1111111111111111111111111111111111111111',
  amount: 1n,
  symbol: 'ETH',
  decimals: 18,
  timestamp: null,
  txRef: null,
  blockNumber: null,
  ...overrides
});

const createChainId = ({
  namespace,
  reference
}: {
  namespace: string;
  reference: string;
}) => ({
  namespace,
  reference,
  toString: () => `${namespace}:${reference}`
});

const createAccount = ({
  id,
  address,
  namespace = evmChainNamespace,
  reference = evmChainReference
}: {
  id: string;
  address: string;
  namespace?: string;
  reference?: string;
}) => ({
  id: {
    toString: () => id
  },
  address,
  chainId: createChainId({ namespace, reference })
});

describe('vault detail core', () => {
  describe('getVaultAddressLookupKey', () => {
    it('normalizes EVM addresses to lowercase for lookup stability', () => {
      const result = getVaultAddressLookupKey({
        chainId: createChainId({
          namespace: evmChainNamespace,
          reference: evmChainReference
        }),
        address: '0xAbCdEf1234567890'
      });

      expect(result).toBe('eip155:1:0xabcdef1234567890');
    });

    it('preserves non-EVM address casing', () => {
      const result = getVaultAddressLookupKey({
        chainId: createChainId({
          namespace: bitcoinChainNamespace,
          reference: bitcoinChainReference
        }),
        address: '1BoatSLRHtKNngkdXEeobR76b53LETtpyT'
      });

      expect(result).toBe(
        'bip122:000000000019d6689c085ae165831e93:1BoatSLRHtKNngkdXEeobR76b53LETtpyT'
      );
    });

    it('throws on unsupported chain namespaces', () => {
      expect(() =>
        getVaultAddressLookupKey({
          chainId: createChainId({
            namespace: 'cosmos',
            reference: 'cosmoshub-4'
          }),
          address: 'cosmos1destination'
        })
      ).toThrow('Unsupported vault address lookup namespace "cosmos"');
    });
  });

  describe('getVaultLabelByLookupKey', () => {
    it('labels same-chain vault addresses by composite lookup key', () => {
      const accounts = [
        createAccount({
          id: 'eth-a',
          address: '0xAbCdEf1111111111111111111111111111111111'
        }),
        createAccount({
          id: 'eth-b',
          address: '0x2222222222222222222222222222222222222222'
        }),
        createAccount({
          id: 'btc-a',
          address: '1BoatSLRHtKNngkdXEeobR76b53LETtpyT',
          namespace: bitcoinChainNamespace,
          reference: bitcoinChainReference
        })
      ] satisfies Parameters<typeof getVaultLabelByLookupKey>[0]['accounts'];
      const supportedChains = [
        {
          chainId: { reference: evmChainReference },
          iconUrl: 'eth-icon',
          name: 'Ethereum',
          nativeCurrency: { symbol: 'ETH' }
        },
        {
          chainId: { reference: bitcoinChainReference },
          iconUrl: 'btc-icon',
          name: 'Bitcoin',
          nativeCurrency: { symbol: 'BTC' }
        }
      ] satisfies Parameters<
        typeof getVaultLabelByLookupKey
      >[0]['supportedChains'];

      const labelByLookupKey = getVaultLabelByLookupKey({
        accounts,
        supportedChains,
        chainId: createChainId({
          namespace: evmChainNamespace,
          reference: evmChainReference
        })
      });

      expect(labelByLookupKey).toEqual({
        'eip155:1:0xabcdef1111111111111111111111111111111111':
          'Ethereum Vault #01',
        'eip155:1:0x2222222222222222222222222222222222222222':
          'Ethereum Vault #02'
      });
    });
  });

  describe('lifecycle metadata helpers', () => {
    const lifecycleCases = [
      {
        lifecycleStatus: { kind: 'safe' },
        expectedDestinationAddress: null,
        expectedTxRef: null
      },
      {
        lifecycleStatus: {
          kind: 'vulnerable',
          exposureReason: 'pubkey-exposed'
        },
        expectedDestinationAddress: null,
        expectedTxRef: null
      },
      {
        lifecycleStatus: {
          kind: 'pending',
          initiatedAt: lifecycleTimestamp,
          destinationAddress: evmAddress,
          txRefs: [evmTxRef]
        },
        expectedDestinationAddress: evmAddress,
        expectedTxRef: evmTxRef
      },
      {
        lifecycleStatus: {
          kind: 'sent',
          confirmedAt: lifecycleTimestamp,
          destinationAddress: evmAddress,
          txRefs: []
        },
        expectedDestinationAddress: evmAddress,
        expectedTxRef: null
      },
      {
        lifecycleStatus: {
          kind: 'withdrawn',
          completedAt: lifecycleTimestamp,
          destinationAddress: evmAddress,
          txRefs: [evmTxRef]
        },
        expectedDestinationAddress: evmAddress,
        expectedTxRef: evmTxRef
      }
    ] satisfies ReadonlyArray<{
      lifecycleStatus: Parameters<typeof getLifecycleDestinationAddress>[0];
      expectedDestinationAddress: string | null;
      expectedTxRef: string | null;
    }>;

    it.each(lifecycleCases)(
      'resolves withdrawal metadata for $lifecycleStatus.kind lifecycle state',
      ({ lifecycleStatus, expectedDestinationAddress, expectedTxRef }) => {
        expect(getLifecycleDestinationAddress(lifecycleStatus)).toBe(
          expectedDestinationAddress
        );
        expect(getLifecyclePrimaryTxRef(lifecycleStatus)).toBe(expectedTxRef);
      }
    );

    it('falls back to activity tx refs when lifecycle tx refs are absent', () => {
      expect(
        resolveLifecycleTxRef({
          lifecycleStatus: {
            kind: 'sent',
            confirmedAt: lifecycleTimestamp,
            destinationAddress: evmAddress,
            txRefs: []
          },
          fallbackTxRef
        })
      ).toBe(fallbackTxRef);
    });

    it('prefers lifecycle tx refs over activity fallback refs', () => {
      expect(
        resolveLifecycleTxRef({
          lifecycleStatus: {
            kind: 'sent',
            confirmedAt: lifecycleTimestamp,
            destinationAddress: evmAddress,
            txRefs: [evmTxRef]
          },
          fallbackTxRef
        })
      ).toBe(evmTxRef);
    });

    it('uses the first lifecycle tx ref as the primary explorer reference', () => {
      expect(
        getLifecyclePrimaryTxRef({
          kind: 'sent',
          confirmedAt: lifecycleTimestamp,
          destinationAddress: evmAddress,
          txRefs: [evmTxRef, secondaryEvmTxRef]
        })
      ).toBe(evmTxRef);
    });

    it('returns null when both lifecycle and fallback tx refs are absent', () => {
      expect(
        resolveLifecycleTxRef({
          lifecycleStatus: {
            kind: 'sent',
            confirmedAt: lifecycleTimestamp,
            destinationAddress: evmAddress,
            txRefs: []
          },
          fallbackTxRef: null
        })
      ).toBeNull();
    });

    it('prefers lifecycle destination address over activity fallback destination', () => {
      expect(
        resolveLifecycleDestinationAddress({
          lifecycleStatus: {
            kind: 'withdrawn',
            completedAt: lifecycleTimestamp,
            destinationAddress: evmAddress,
            txRefs: []
          },
          fallbackDestinationAddress:
            '0x2222222222222222222222222222222222222222'
        })
      ).toBe(evmAddress);
    });

    it('falls back to activity destination when lifecycle destination metadata is unavailable', () => {
      expect(
        resolveLifecycleDestinationAddress({
          lifecycleStatus: { kind: 'safe' },
          fallbackDestinationAddress:
            '0x3333333333333333333333333333333333333333'
        })
      ).toBe('0x3333333333333333333333333333333333333333');
    });

    it('returns null when both lifecycle and activity destination metadata are unavailable', () => {
      expect(
        resolveLifecycleDestinationAddress({
          lifecycleStatus: { kind: 'safe' },
          fallbackDestinationAddress: null
        })
      ).toBeNull();
    });
  });

  describe('isRecordlessWithdrawnLifecycle', () => {
    it('returns true for the recovered exposed-empty withdrawn shape', () => {
      expect(
        isRecordlessWithdrawnLifecycle({
          kind: 'withdrawn',
          completedAt: null,
          destinationAddress: null,
          txRefs: []
        })
      ).toBe(true);
    });

    it('returns false for record-backed withdrawn lifecycle', () => {
      expect(
        isRecordlessWithdrawnLifecycle({
          kind: 'withdrawn',
          completedAt: lifecycleTimestamp,
          destinationAddress: evmAddress,
          txRefs: [evmTxRef]
        })
      ).toBe(false);
    });

    it('returns false when only the destination address is missing but tx refs exist', () => {
      // Defensive: future SDK shapes might surface partial metadata. We must
      // only short-circuit the activity fallback when both signals are
      // absent, since a real tx ref is authoritative proof of a user-driven
      // withdrawal.
      expect(
        isRecordlessWithdrawnLifecycle({
          kind: 'withdrawn',
          completedAt: null,
          destinationAddress: null,
          txRefs: [evmTxRef]
        })
      ).toBe(false);
    });

    it('returns false for non-withdrawn lifecycle kinds', () => {
      expect(isRecordlessWithdrawnLifecycle({ kind: 'safe' })).toBe(false);
      expect(
        isRecordlessWithdrawnLifecycle({
          kind: 'vulnerable',
          exposureReason: 'pubkey-exposed'
        })
      ).toBe(false);
      expect(
        isRecordlessWithdrawnLifecycle({
          kind: 'pending',
          initiatedAt: lifecycleTimestamp,
          destinationAddress: evmAddress,
          txRefs: []
        })
      ).toBe(false);
      expect(
        isRecordlessWithdrawnLifecycle({
          kind: 'sent',
          confirmedAt: lifecycleTimestamp,
          destinationAddress: evmAddress,
          txRefs: []
        })
      ).toBe(false);
    });
  });

  describe('resolveLifecycleDestinationLabel', () => {
    it('labels known internal destination vaults with a shortened address suffix', () => {
      const destinationAddress = '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12';
      const lookupKey = getVaultAddressLookupKey({
        chainId: createChainId({
          namespace: evmChainNamespace,
          reference: evmChainReference
        }),
        address: destinationAddress
      });

      const result = resolveLifecycleDestinationLabel({
        destinationAddress,
        vaultLabelByLookupKey: {
          [lookupKey]: 'Ethereum Vault #02'
        },
        selectedChainId: createChainId({
          namespace: evmChainNamespace,
          reference: evmChainReference
        })
      });

      expect(result).toBe('Ethereum Vault #02 (0xAbCdEf...CdEf12)');
    });

    it('falls back to a shortened address for unknown destinations', () => {
      const destinationAddress = '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12';

      const result = resolveLifecycleDestinationLabel({
        destinationAddress,
        vaultLabelByLookupKey: {},
        selectedChainId: createChainId({
          namespace: evmChainNamespace,
          reference: evmChainReference
        })
      });

      expect(result).toBe('0xAbCdEf...CdEf12');
    });
  });

  describe('resolveSuccessStateIconKind', () => {
    const successIconCases = [
      {
        lifecycleKind: 'sent',
        onChainVaultStatus: 'vulnerable',
        expectedIconKind: 'withdraw-to-safe'
      },
      {
        lifecycleKind: 'sent',
        onChainVaultStatus: 'safe',
        expectedIconKind: 'check'
      },
      {
        lifecycleKind: 'withdrawn',
        onChainVaultStatus: 'vulnerable',
        expectedIconKind: 'check'
      }
    ] satisfies ReadonlyArray<{
      lifecycleKind: Parameters<
        typeof resolveSuccessStateIconKind
      >[0]['lifecycleKind'];
      onChainVaultStatus: Parameters<
        typeof resolveSuccessStateIconKind
      >[0]['onChainVaultStatus'];
      expectedIconKind: ReturnType<typeof resolveSuccessStateIconKind>;
    }>;

    it.each(successIconCases)(
      'resolves $expectedIconKind for $lifecycleKind from $onChainVaultStatus vaults',
      ({ lifecycleKind, onChainVaultStatus, expectedIconKind }) => {
        expect(
          resolveSuccessStateIconKind({
            lifecycleKind,
            onChainVaultStatus
          })
        ).toBe(expectedIconKind);
      }
    );
  });

  describe('resolveWithdrawAvailability', () => {
    const ethThreshold =
      withdrawNativeBalanceThresholdByNamespace[evmChainNamespace];
    const bitcoinThreshold =
      withdrawNativeBalanceThresholdByNamespace[bitcoinChainNamespace];
    const withdrawBalanceStates = [
      {
        label: 'zero native balance',
        nativeBalance: 0n,
        expectedKind: 'hidden'
      },
      {
        label: 'below threshold native balance',
        nativeBalanceByNamespace: {
          [evmChainNamespace]: ethThreshold - 1n,
          [bitcoinChainNamespace]: bitcoinThreshold - 1n
        },
        expectedKind: 'disabled'
      },
      {
        label: 'at threshold native balance',
        nativeBalanceByNamespace: {
          [evmChainNamespace]: ethThreshold,
          [bitcoinChainNamespace]: bitcoinThreshold
        },
        expectedKind: 'enabled'
      },
      {
        label: 'above threshold native balance',
        nativeBalanceByNamespace: {
          [evmChainNamespace]: ethThreshold + 1n,
          [bitcoinChainNamespace]: bitcoinThreshold + 1n
        },
        expectedKind: 'enabled'
      }
    ] as const;
    const nativeAssetByNamespace = {
      [evmChainNamespace]: {
        symbol: 'ETH',
        slip44Reference: '60'
      },
      [bitcoinChainNamespace]: {
        symbol: 'BTC',
        slip44Reference: '0'
      }
    } as const;
    const chainNamespaces = [evmChainNamespace, bitcoinChainNamespace] as const;
    const withdrawAvailabilityCases = chainNamespaces.flatMap(chainNamespace =>
      withdrawBalanceStates.map(balanceState => {
        const nativeBalance =
          'nativeBalance' in balanceState
            ? balanceState.nativeBalance
            : balanceState.nativeBalanceByNamespace[chainNamespace];

        return {
          chainNamespace,
          nativeBalance,
          expectedKind: balanceState.expectedKind
        };
      })
    );

    it.each(withdrawAvailabilityCases)(
      'resolves $expectedKind on $chainNamespace with native balance $nativeBalance',
      ({ chainNamespace, nativeBalance, expectedKind }) => {
        const nativeAsset = nativeAssetByNamespace[chainNamespace];
        const result = resolveWithdrawAvailability({
          selectedChainNamespace: chainNamespace,
          assets: createWithdrawAssets({
            nativeSymbol: nativeAsset.symbol,
            nativeSlip44Reference: nativeAsset.slip44Reference
          }),
          balances: createWithdrawBalances({
            nativeSymbol: nativeAsset.symbol,
            nativeBalance
          }),
          disabledMessageByNamespace: withdrawDisabledMessageByNamespace,
          hasNonInterfaceAssetBalance: false,
          nonInterfaceAssetMessage: 'Unsupported token balances are present.'
        });

        expect(result.kind).toBe(expectedKind);

        if (result.kind === 'disabled') {
          expect(result.message).toBe(
            withdrawDisabledMessageByNamespace[chainNamespace]
          );
        }
      }
    );

    it('throws when native asset metadata is missing', () => {
      expect(() =>
        resolveWithdrawAvailability({
          selectedChainNamespace: evmChainNamespace,
          assets: [],
          balances: [],
          disabledMessageByNamespace: withdrawDisabledMessageByNamespace,
          hasNonInterfaceAssetBalance: false,
          nonInterfaceAssetMessage: 'Unsupported token balances are present.'
        })
      ).toThrow('native asset metadata for withdraw availability');
    });

    it('throws when native asset balance is missing', () => {
      expect(() =>
        resolveWithdrawAvailability({
          selectedChainNamespace: evmChainNamespace,
          assets: createWithdrawAssets({
            nativeSymbol: 'ETH',
            nativeSlip44Reference: '60'
          }),
          balances: createWithdrawBalances({
            nativeSymbol: 'DAI',
            nativeBalance: 1n
          }),
          disabledMessageByNamespace: withdrawDisabledMessageByNamespace,
          hasNonInterfaceAssetBalance: false,
          nonInterfaceAssetMessage: 'Unsupported token balances are present.'
        })
      ).toThrow('native asset balance for ETH');
    });

    it('disables withdrawal when unsupported token balances are present', () => {
      const message = 'Unsupported token balances are present.';
      const result = resolveWithdrawAvailability({
        selectedChainNamespace: evmChainNamespace,
        assets: createWithdrawAssets({
          nativeSymbol: 'ETH',
          nativeSlip44Reference: '60'
        }),
        balances: createWithdrawBalances({
          nativeSymbol: 'ETH',
          nativeBalance: ethThreshold
        }),
        disabledMessageByNamespace: withdrawDisabledMessageByNamespace,
        hasNonInterfaceAssetBalance: true,
        nonInterfaceAssetMessage: message
      });

      expect(result).toEqual({
        kind: 'disabled',
        message
      });
    });
  });

  describe('resolveActivityDateLabel', () => {
    it('returns block label when timestamp is missing and block number is present', () => {
      const result = resolveActivityDateLabel({
        timestamp: null,
        blockNumber: 42n
      });

      expect(result).toBe('Block 42');
    });

    it('returns pending label when timestamp and block number are missing', () => {
      const result = resolveActivityDateLabel({
        timestamp: null,
        blockNumber: null
      });

      expect(result).toBe('Pending');
    });
  });

  describe('getTxUrlFromRef', () => {
    it('resolves EVM tx references to Etherscan metadata', () => {
      expect(getTxExplorerMetadataFromRef(evmTxRef)).toEqual({
        name: 'Etherscan',
        url: `https://etherscan.io/tx/${evmTxRef}`
      });
    });

    it('resolves EVM tx references to etherscan links', () => {
      const txRef =
        '0x95d0c0a9f7eb489ccb6d2e2d8af17a58fa2df04af745cc34eddf566f5f04789a';
      const result = getTxUrlFromRef(txRef);

      expect(result).toBe(`https://etherscan.io/tx/${txRef}`);
    });

    it('resolves BTC tx references to mempool links', () => {
      const txRef =
        '95d0c0a9f7eb489ccb6d2e2d8af17a58fa2df04af745cc34eddf566f5f04789a';
      const result = getTxUrlFromRef(txRef);

      expect(result).toBe(`https://mempool.space/tx/${txRef}`);
      expect(getTxExplorerMetadataFromRef(txRef)).toEqual({
        name: 'mempool.space',
        url: `https://mempool.space/tx/${txRef}`
      });
    });

    it('returns null for invalid transaction references', () => {
      expect(getTxUrlFromRef('invalid')).toBeNull();
      expect(getTxExplorerMetadataFromRef('invalid')).toBeNull();
    });
  });

  describe('getLatestOutboundActivity', () => {
    it('returns latest outbound by timestamp, then block number', () => {
      const rows: ReadonlyArray<ActivityRow> = [
        createActivityRow({
          id: 'inbound',
          direction: 'inbound',
          timestamp: 1709424000,
          blockNumber: 100n
        }),
        createActivityRow({
          id: 'outbound-old',
          direction: 'outbound',
          timestamp: 1709251200,
          blockNumber: 120n
        }),
        createActivityRow({
          id: 'outbound-latest',
          direction: 'outbound',
          timestamp: 1709596800,
          blockNumber: 101n
        })
      ];

      const result = getLatestOutboundActivity(rows);

      expect(result?.id).toBe('outbound-latest');
    });

    it('returns undefined when no outbound activities are present', () => {
      const rows: ReadonlyArray<ActivityRow> = [
        createActivityRow({ id: 'inbound-1', direction: 'inbound' }),
        createActivityRow({ id: 'inbound-2', direction: 'inbound' })
      ];

      expect(getLatestOutboundActivity(rows)).toBeUndefined();
    });
  });

  describe('resolveWithdrawnActivityFallbackMetadata', () => {
    it('uses the latest outbound activity counterparty and tx ref', () => {
      const result = resolveWithdrawnActivityFallbackMetadata([
        createActivityRow({
          id: 'outbound-earlier',
          direction: 'outbound',
          counterparty: '0x2222222222222222222222222222222222222222',
          txRef: fallbackTxRef,
          blockNumber: 10n
        }),
        createActivityRow({
          id: 'outbound-latest',
          direction: 'outbound',
          counterparty: '0x3333333333333333333333333333333333333333',
          txRef: evmTxRef,
          blockNumber: 11n
        })
      ]);

      expect(result).toEqual({
        destinationAddress: '0x3333333333333333333333333333333333333333',
        txRef: evmTxRef
      });
    });

    it('keeps tx ref null when outbound fallback activity has no tx ref', () => {
      const result = resolveWithdrawnActivityFallbackMetadata([
        createActivityRow({
          id: 'outbound-without-tx-ref',
          direction: 'outbound',
          counterparty: '0x4444444444444444444444444444444444444444',
          txRef: null,
          blockNumber: 12n
        })
      ]);

      expect(result).toEqual({
        destinationAddress: '0x4444444444444444444444444444444444444444',
        txRef: null
      });
    });

    it('returns null fallback metadata when no outbound activity exists', () => {
      const result = resolveWithdrawnActivityFallbackMetadata([
        createActivityRow({
          id: 'inbound-only',
          direction: 'inbound',
          counterparty: '0x5555555555555555555555555555555555555555',
          txRef: fallbackTxRef,
          blockNumber: 13n
        })
      ]);

      expect(result).toEqual({
        destinationAddress: null,
        txRef: null
      });
    });
  });
});
