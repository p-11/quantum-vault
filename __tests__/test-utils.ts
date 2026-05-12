const retryableHttpStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);
const retryDelaysMs = [500, 1000, 2000];

type RpcMutationRequest = {
  method: string;
  params: unknown[];
  operation: string;
};

const sleep = (delayMs: number): Promise<void> =>
  new Promise(resolve => {
    setTimeout(resolve, delayMs);
  });

const getRpcErrorMessage = (payload: unknown): string | null => {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const errorValue = Reflect.get(payload, 'error');
  if (typeof errorValue !== 'object' || errorValue === null) {
    return null;
  }
  const message = Reflect.get(errorValue, 'message');
  return typeof message === 'string' ? message : 'Unknown RPC error';
};

const isRetryableRpcErrorMessage = (message: string): boolean => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('rate limit') ||
    normalized.includes('too many requests') ||
    normalized.includes('temporarily unavailable') ||
    normalized.includes('timeout')
  );
};

const postRpcMutation = async ({
  method,
  params,
  operation
}: RpcMutationRequest): Promise<void> => {
  const rpcUrl = process.env.VITE_ETHEREUM_RPC_URL;
  if (!rpcUrl) {
    throw new Error('VITE_ETHEREUM_RPC_URL is required for E2E RPC mutations');
  }

  let lastError: unknown = null;

  for (const [attemptIndex, delayMs] of retryDelaysMs.entries()) {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id: 1
      })
    });

    if (!response.ok) {
      const message = `${operation}: ${response.status} ${response.statusText}`;
      const shouldRetry =
        retryableHttpStatuses.has(response.status) &&
        attemptIndex < retryDelaysMs.length - 1;
      if (shouldRetry) {
        await sleep(delayMs);
        continue;
      }
      throw new Error(message);
    }

    const payload = await response.json().catch(() => null);
    const rpcErrorMessage = getRpcErrorMessage(payload);
    if (!rpcErrorMessage) {
      return;
    }

    lastError = new Error(`${operation}: ${rpcErrorMessage}`);
    const shouldRetry =
      isRetryableRpcErrorMessage(rpcErrorMessage) &&
      attemptIndex < retryDelaysMs.length - 1;
    if (shouldRetry) {
      await sleep(delayMs);
      continue;
    }
    throw lastError;
  }

  throw lastError ?? new Error(`${operation}: request failed after retries`);
};

export const fundAccountWithEth = async (address: string): Promise<void> => {
  await postRpcMutation({
    method: 'tenderly_setBalance',
    params: [[address], '0xDE0B6B3A7640000'], // 1 ETH
    operation: 'Failed to fund account with ETH'
  });
};

export const fundAccountWithTinyEth = async (
  address: string
): Promise<void> => {
  await postRpcMutation({
    method: 'tenderly_setBalance',
    params: [[address], '0x1'], // 1 wei - enough to appear in the summary but far below gas cost
    operation: 'Failed to fund account with tiny ETH'
  });
};

export const drainAccount = async (address: string): Promise<void> => {
  await postRpcMutation({
    method: 'tenderly_setBalance',
    params: [[address], '0x0'], // drain to 0
    operation: 'Failed to drain account'
  });
};

export const fundAccountWithUSDC = async (address: string): Promise<void> => {
  await postRpcMutation({
    method: 'tenderly_setErc20Balance',
    params: [
      '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC contract address
      [address],
      '0x5F5E100' // 100 USDC
    ],
    operation: 'Failed to fund account with USDC'
  });
};

export function shortenAddress(address: string, chars: number = 6): string {
  return `${address.slice(0, 2 + chars)}...${address.slice(-chars)}`;
}

export function generateDomainNameFromAddress(address: string): string {
  return `domain${address.slice(0, 8)}.q`;
}
