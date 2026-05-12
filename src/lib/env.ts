import { ensurePresent } from './assert';

// Strict env getters for the VITE_* variables the extension depends on.
//
// All getters follow the same policy:
// - Lazy: each getter is invoked from inside the wallet boot code, not at
//   module-import time. This lets the WalletProvider boundary catch any
//   missing-env throw and render a BootErrorScreen instead of crashing
//   the React tree.
// - Strict: missing values throw via ensurePresent with an actionable
//   error message naming the variable and pointing at the README.
// - Whitespace-tolerant: a value of `" "` is treated as missing, not as a
//   valid string. GitHub Actions silently substitutes empty strings for
//   missing secret references and a typo could leave a single space in
//   place of a real value; both should fail-loud the same way.
//
// No public fallbacks. A wallet popup that silently routes chain reads
// through a third-party public RPC without the developer's explicit
// configuration is more dangerous than failing to start with a clear
// error - the failure is loud, the cause is named, and the recovery
// path (fix .env, reload extension) is obvious.
const requireEnv = (key: string, value: string | undefined): string => {
  const normalized = value?.trim();
  return ensurePresent(
    normalized && normalized.length > 0 ? normalized : undefined,
    `${key} (set in repo Settings -> Secrets and Variables, see README#environment)`
  );
};

export const getRegisterUrl = (): string =>
  requireEnv('VITE_REGISTER_URL', import.meta.env.VITE_REGISTER_URL);

export const getEthereumRpcUrl = (): string =>
  requireEnv('VITE_ETHEREUM_RPC_URL', import.meta.env.VITE_ETHEREUM_RPC_URL);

export const getBitcoinApiUrl = (): string =>
  requireEnv('VITE_BITCOIN_API_URL', import.meta.env.VITE_BITCOIN_API_URL);

export const getEthereumBundlerRpcUrl = (): string =>
  requireEnv(
    'VITE_ETHEREUM_BUNDLER_RPC_URL',
    import.meta.env.VITE_ETHEREUM_BUNDLER_RPC_URL
  );

export const getEthereumBundlerApiKey = (): string =>
  requireEnv(
    'VITE_ETHEREUM_BUNDLER_API_KEY',
    import.meta.env.VITE_ETHEREUM_BUNDLER_API_KEY
  );

export const getAssetPricesUrl = (): string =>
  requireEnv('VITE_ASSET_PRICES_URL', import.meta.env.VITE_ASSET_PRICES_URL);
