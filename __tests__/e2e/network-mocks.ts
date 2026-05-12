import type { Page } from '@playwright/test';

export const DEFAULT_RECOVERY_EVM_ADDRESS =
  '0x2D02E0c31958b9074F96FF71B42b416fD2c35675';
export const DEFAULT_RECOVERY_BTC_ADDRESS =
  'bc1qs5mlpxfrfzfacpme683an38tdf353vt0cry9g2';

type JsonRpcRequest = {
  id?: number | string | null;
  method?: string;
  params?: unknown[];
};

type JsonRpcResponse = {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: string;
  };
};

type UnknownRpcMethodPolicy = 'error' | 'zero';
type EthCallBehavior = 'account-not-deployed' | 'empty-success';
type ParsedJsonRpcRequestBody = {
  requests: JsonRpcRequest[];
  isBatch: boolean;
};

const CHAIN_RPC_METHOD_RESULT: Record<string, string> = {
  eth_blockNumber: '0x1',
  eth_getBalance: '0x0',
  eth_getTransactionCount: '0x0',
  eth_gasPrice: '0x1',
  eth_maxPriorityFeePerGas: '0x1'
};

const LOCAL_ETHEREUM_RPC_ORIGINS = [
  'http://127.0.0.1:8545',
  'http://localhost:8545'
] as const;
const LOCAL_BASE_RPC_ORIGINS = [
  'http://127.0.0.1:8546',
  'http://localhost:8546'
] as const;
const LOCAL_BITCOIN_API_ORIGINS = [
  'http://127.0.0.1:3001',
  'http://localhost:3001'
] as const;

const parseEnvOrigin = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const parseJsonRpcRequestValue = (parsed: unknown): JsonRpcRequest => {
  if (typeof parsed !== 'object' || parsed === null) {
    return {};
  }
  const rawId = Reflect.get(parsed, 'id');
  const rawMethod = Reflect.get(parsed, 'method');
  const rawParams = Reflect.get(parsed, 'params');

  const request: JsonRpcRequest = {};
  if (
    rawId === null ||
    typeof rawId === 'number' ||
    typeof rawId === 'string'
  ) {
    request.id = rawId;
  }
  if (typeof rawMethod === 'string') {
    request.method = rawMethod;
  }
  if (Array.isArray(rawParams)) {
    request.params = rawParams;
  }
  return request;
};

const parseJsonRpcRequest = (body: string): ParsedJsonRpcRequestBody => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(body);
  } catch {
    return { requests: [{}], isBatch: false };
  }

  if (Array.isArray(parsed)) {
    return {
      requests: parsed.map(parseJsonRpcRequestValue),
      isBatch: true
    };
  }

  return {
    requests: [parseJsonRpcRequestValue(parsed)],
    isBatch: false
  };
};

const isHexAddress = (value: string): boolean =>
  /^0x[a-fA-F0-9]{40}$/.test(value);

const resolveAddressFromJsonRpcParam = (value: unknown): string | null =>
  typeof value === 'string' && isHexAddress(value) ? value.toLowerCase() : null;

const toAddressLookupSet = (addresses: ReadonlyArray<string>): Set<string> =>
  new Set(addresses.map(address => address.toLowerCase()));

const resolveAddressFromEthCallBalanceOfData = (
  callPayload: unknown
): string | null => {
  if (typeof callPayload !== 'object' || callPayload === null) {
    return null;
  }

  const rawData = Reflect.get(callPayload, 'data');
  if (typeof rawData !== 'string') {
    return null;
  }

  const normalizedData = rawData.toLowerCase();
  const balanceOfMethodSelector = '0x70a08231';
  if (!normalizedData.startsWith(balanceOfMethodSelector)) {
    return null;
  }

  const encodedAddress = normalizedData.slice(-40);
  if (!/^[0-9a-f]{40}$/.test(encodedAddress)) {
    return null;
  }

  return `0x${encodedAddress}`;
};

const buildAccountNotDeployedErrorData = (address: string): string =>
  `0x6ca7b806000000000000000000000000${address.slice(2).toLowerCase()}`;

const resolveResponseId = (value: JsonRpcRequest['id']): number | string =>
  value === null || value === undefined ? 1 : value;

const resolveJsonRpcPayload = ({
  accountNotDeployedErrorData,
  chainIdHex,
  parsed,
  resolvedEthBalance,
  exposedEvmAddresses,
  unknownRpcMethodPolicy,
  ethCallBehavior
}: {
  accountNotDeployedErrorData: string;
  chainIdHex: '0x1' | '0x2105';
  parsed: JsonRpcRequest;
  resolvedEthBalance: string | null | undefined;
  exposedEvmAddresses: ReadonlySet<string>;
  unknownRpcMethodPolicy: UnknownRpcMethodPolicy;
  ethCallBehavior: EthCallBehavior;
}): JsonRpcResponse => {
  const responseId = resolveResponseId(parsed.id);
  const unsupportedMethod = parsed.method ?? 'unknown';

  if (!parsed.method) {
    return {
      jsonrpc: '2.0',
      id: responseId,
      error: {
        code: -32600,
        message: 'Invalid JSON-RPC request'
      }
    };
  }

  if (parsed.method === 'eth_call') {
    if (ethCallBehavior === 'empty-success') {
      return {
        jsonrpc: '2.0',
        id: responseId,
        result: '0x'
      };
    }

    return {
      jsonrpc: '2.0',
      id: responseId,
      error: {
        code: 3,
        message: 'execution reverted',
        data: accountNotDeployedErrorData
      }
    };
  }

  if (parsed.method === 'eth_getBalance' && resolvedEthBalance) {
    return {
      jsonrpc: '2.0',
      id: responseId,
      result: resolvedEthBalance
    };
  }

  if (parsed.method === 'eth_chainId') {
    return {
      jsonrpc: '2.0',
      id: responseId,
      result: chainIdHex
    };
  }

  if (parsed.method === 'eth_getCode') {
    const address = resolveAddressFromJsonRpcParam(parsed.params?.[0]);
    return {
      jsonrpc: '2.0',
      id: responseId,
      result:
        address && exposedEvmAddresses.has(address.toLowerCase())
          ? '0x01'
          : '0x'
    };
  }

  if (parsed.method === 'eth_getLogs') {
    return {
      jsonrpc: '2.0',
      id: responseId,
      result: []
    };
  }

  const methodResult = CHAIN_RPC_METHOD_RESULT[parsed.method];
  if (methodResult !== undefined) {
    return {
      jsonrpc: '2.0',
      id: responseId,
      result: methodResult
    };
  }

  return {
    jsonrpc: '2.0',
    id: responseId,
    ...(unknownRpcMethodPolicy === 'zero'
      ? { result: '0x0' }
      : {
          error: {
            code: -32601,
            message: `Unsupported mocked RPC method: ${unsupportedMethod}`
          }
        })
  };
};

type InstallDeterministicRecoveryNetworkInput = {
  page: Page;
  evmAddress?: string;
  btcAddress?: string;
  exposedEvmAddresses?: ReadonlyArray<string>;
  bitcoinOutgoingAddresses?: ReadonlyArray<string>;
  resolveEthBalance?: (address: string) => string | null;
  unknownRpcMethodPolicy?: UnknownRpcMethodPolicy;
  ethCallBehavior?: EthCallBehavior;
};

const buildBitcoinOutgoingTx = (address: string) => ({
  txid: 'f95d7c8a7d2dfdf321f0e29d4f801722f2869bf5c35b76e3b50f9fca2b68d940',
  status: {
    confirmed: true,
    block_height: 800_000
  },
  vin: [
    {
      prevout: {
        scriptpubkey_address: address,
        value: 1_000
      }
    }
  ],
  vout: [
    {
      scriptpubkey_address: 'bc1qwithdrawndestination000000000000000000000',
      value: 900
    }
  ]
});

export const installDeterministicRecoveryNetwork = async ({
  page,
  evmAddress = DEFAULT_RECOVERY_EVM_ADDRESS,
  btcAddress = DEFAULT_RECOVERY_BTC_ADDRESS,
  exposedEvmAddresses = [],
  bitcoinOutgoingAddresses = [],
  resolveEthBalance,
  unknownRpcMethodPolicy = 'error',
  ethCallBehavior = 'account-not-deployed'
}: InstallDeterministicRecoveryNetworkInput): Promise<void> => {
  const fallbackEvmAddress = evmAddress.toLowerCase();
  const exposedEvmAddressSet = toAddressLookupSet(exposedEvmAddresses);
  const bitcoinOutgoingAddressSet = toAddressLookupSet(
    bitcoinOutgoingAddresses
  );

  const mainnetRpcOrigins = new Set<string>([
    'https://eth.llamarpc.com',
    ...LOCAL_ETHEREUM_RPC_ORIGINS
  ]);
  const baseRpcOrigins = new Set<string>([
    'https://base.llamarpc.com',
    ...LOCAL_BASE_RPC_ORIGINS
  ]);
  const envEthOrigin = parseEnvOrigin(process.env.VITE_ETHEREUM_RPC_URL);
  const envEthBundlerOrigin = parseEnvOrigin(
    process.env.VITE_ETHEREUM_BUNDLER_RPC_URL
  );
  const envBaseOrigin = parseEnvOrigin(process.env.VITE_BASE_RPC_URL);
  const envBaseBundlerOrigin = parseEnvOrigin(
    process.env.VITE_BASE_BUNDLER_RPC_URL
  );
  if (envEthOrigin) {
    mainnetRpcOrigins.add(envEthOrigin);
  }
  if (envEthBundlerOrigin) {
    mainnetRpcOrigins.add(envEthBundlerOrigin);
  }
  if (envBaseOrigin) {
    baseRpcOrigins.add(envBaseOrigin);
  }
  if (envBaseBundlerOrigin) {
    baseRpcOrigins.add(envBaseBundlerOrigin);
  }

  const rpcOrigins = new Set<string>([...mainnetRpcOrigins, ...baseRpcOrigins]);
  for (const origin of rpcOrigins) {
    let lastResolvedEvmAddress = fallbackEvmAddress;

    await page.route(`${origin}/**`, async route => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }

      const requestUrl = new URL(route.request().url());
      const chainIdHex: '0x1' | '0x2105' = baseRpcOrigins.has(requestUrl.origin)
        ? '0x2105'
        : '0x1';
      const body = route.request().postData();
      const parsedBody = body
        ? parseJsonRpcRequest(body)
        : { requests: [{}], isBatch: false };
      const responses = parsedBody.requests.map(parsed => {
        const rawAddress = parsed.params?.[0];
        const paramAddress = resolveAddressFromJsonRpcParam(rawAddress);
        const ethCallAddress =
          resolveAddressFromEthCallBalanceOfData(rawAddress);
        const balanceAddress = paramAddress ?? ethCallAddress;
        const resolvedEvmAddress =
          paramAddress ?? ethCallAddress ?? lastResolvedEvmAddress;
        lastResolvedEvmAddress = resolvedEvmAddress;
        const resolvedEthBalance = balanceAddress
          ? resolveEthBalance?.(balanceAddress)
          : null;
        const accountNotDeployedErrorData =
          buildAccountNotDeployedErrorData(resolvedEvmAddress);

        return resolveJsonRpcPayload({
          accountNotDeployedErrorData,
          chainIdHex,
          parsed,
          resolvedEthBalance,
          exposedEvmAddresses: exposedEvmAddressSet,
          unknownRpcMethodPolicy,
          ethCallBehavior
        });
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(parsedBody.isBatch ? responses : responses[0])
      });
    });
  }

  const bitcoinOrigins = new Set<string>([
    'https://blockstream.info',
    ...LOCAL_BITCOIN_API_ORIGINS
  ]);
  const envBitcoinOrigin = parseEnvOrigin(process.env.VITE_BITCOIN_API_URL);
  if (envBitcoinOrigin) {
    bitcoinOrigins.add(envBitcoinOrigin);
  }

  for (const origin of bitcoinOrigins) {
    await page.route(`${origin}/**`, async route => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }

      const pathname = new URL(route.request().url()).pathname;
      if (!pathname.includes('/address/') && !pathname.includes('/txs')) {
        await route.continue();
        return;
      }

      if (pathname.endsWith('/txs/mempool')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([])
        });
        return;
      }

      if (pathname.endsWith('/txs')) {
        const requestedAddress = pathname.split('/').at(-2) ?? btcAddress;
        const body = bitcoinOutgoingAddressSet.has(
          requestedAddress.toLowerCase()
        )
          ? [buildBitcoinOutgoingTx(requestedAddress)]
          : [];

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(body)
        });
        return;
      }

      const requestedAddress = pathname.split('/').at(-1);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          address: requestedAddress ?? btcAddress,
          chain_stats: {
            funded_txo_count: 0,
            funded_txo_sum: 0,
            spent_txo_count: 0,
            spent_txo_sum: 0,
            tx_count: 0
          },
          mempool_stats: {
            funded_txo_count: 0,
            funded_txo_sum: 0,
            spent_txo_count: 0,
            spent_txo_sum: 0,
            tx_count: 0
          }
        })
      });
    });
  }

  const priceOrigins = new Set<string>(['https://assets.projecteleven.com']);
  const envPricesOrigin = parseEnvOrigin(process.env.VITE_ASSET_PRICES_URL);
  if (envPricesOrigin) {
    priceOrigins.add(envPricesOrigin);
  }
  for (const origin of priceOrigins) {
    await page.route(`${origin}/**`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          bitcoin: { usd: 50000, usd_24h_change: 0 },
          ethereum: { usd: 2500, usd_24h_change: 0 }
        })
      })
    );
  }
};
