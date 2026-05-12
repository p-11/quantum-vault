import {
  CsprngUnavailableError,
  IncorrectPasswordError,
  KeyDerivationError,
  MissingChainError,
  NoPasswordSetError,
  VaultCorruptedError,
  VaultLockedError
} from '@project-eleven/libqc';

import { attempt } from '@/lib/attempt';
import { toastMessages } from '@/lib/content';
import { extractErrorMsg } from '@/lib/error';

const maxErrorLineageDepth = 5;

export type QueryErrorCategory =
  | 'vaultState'
  | 'envMisconfigured'
  | 'rateLimited'
  | 'rpcUnavailable'
  | 'networkConnectivity'
  | 'generic';

type QueryErrorMessageKey =
  | 'vaultQueryVaultStateFailed'
  | 'vaultQueryConfigInvalid'
  | 'vaultQueryRateLimited'
  | 'vaultQueryRpcUnavailable'
  | 'vaultQueryNetworkUnavailable'
  | 'unexpectedError';

type NonGenericQueryErrorCategory = Exclude<QueryErrorCategory, 'generic'>;

export const queryErrorMessageKeyByCategory: Record<
  QueryErrorCategory,
  QueryErrorMessageKey
> = {
  vaultState: 'vaultQueryVaultStateFailed',
  envMisconfigured: 'vaultQueryConfigInvalid',
  rateLimited: 'vaultQueryRateLimited',
  rpcUnavailable: 'vaultQueryRpcUnavailable',
  networkConnectivity: 'vaultQueryNetworkUnavailable',
  generic: 'unexpectedError'
};

const categoryResolutionOrder: ReadonlyArray<NonGenericQueryErrorCategory> = [
  'vaultState',
  'rateLimited',
  'rpcUnavailable',
  'networkConnectivity',
  'envMisconfigured'
];

const vaultStateErrorNames = new Set([
  'vaultlockederror',
  'vaultcorruptederror',
  'nopasswordseterror',
  'incorrectpassworderror',
  'keyderivationerror'
]);

const envErrorNames = new Set(['missingchainerror', 'csprngunavailableerror']);

const rateLimitMessageTokens = ['too many requests', 'rate limit'] as const;

const rpcUnavailableMessageTokens = [
  'rpc unavailable',
  'service unavailable',
  'gateway timeout',
  'bad gateway',
  'upstream connect error'
] as const;

const networkMessageTokens = [
  'failed to fetch',
  'fetch failed',
  'network request failed',
  'network error',
  'internet disconnected',
  'offline',
  'connection refused',
  'connection reset',
  'timed out'
] as const;

const envMessageTokens = [
  'set in repo settings -> secrets and variables',
  'missing environment variable',
  'publicclient must have a chain',
  'wallet configuration is missing or invalid'
] as const;

const networkCodeTokens = new Set([
  'econnaborted',
  'econnrefused',
  'econnreset',
  'enetunreach',
  'enotfound',
  'etimedout',
  'network_error',
  'networkerror'
]);

const rpcStatusCodes = new Set([502, 503, 504]);
const rateLimitStatusCodes = new Set([429]);
const envVarPattern = /\bvite_[a-z0-9_]+\b/;

type ResolverContext = {
  error: unknown;
  normalizedMessages: Array<string>;
  normalizedNames: Array<string>;
  statusCodes: Array<number>;
  normalizedCodes: Array<string>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object';

const readRecordValue = ({
  source,
  key
}: {
  source: unknown;
  key: string;
}): unknown => {
  if (!isRecord(source)) {
    return undefined;
  }

  const result = attempt(() => source[key]);
  if ('error' in result) {
    return undefined;
  }

  return result.data;
};

const getErrorCause = (error: unknown): unknown =>
  readRecordValue({ source: error, key: 'cause' });

const toStatusCode = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }

  return undefined;
};

const getStatusCodesFromSource = (source: unknown): Array<number> => {
  const statusCandidates = [
    readRecordValue({ source, key: 'status' }),
    readRecordValue({ source, key: 'statusCode' })
  ];

  const statusCodes: Array<number> = [];
  for (const candidate of statusCandidates) {
    const statusCode = toStatusCode(candidate);
    if (statusCode !== undefined) {
      statusCodes.push(statusCode);
    }
  }

  return statusCodes;
};

const getNormalizedCodesFromSource = (source: unknown): Array<string> => {
  const codeCandidate = readRecordValue({ source, key: 'code' });
  if (typeof codeCandidate === 'string' || typeof codeCandidate === 'number') {
    return [String(codeCandidate).toLowerCase()];
  }

  return [];
};

const getNormalizedMessageFromSource = (source: unknown): string => {
  const message = extractErrorMsg(source);
  return typeof message === 'string' ? message.toLowerCase() : '';
};

const getNormalizedNameFromSource = (source: unknown): string => {
  if (source instanceof Error) {
    return source.name.toLowerCase();
  }

  const name = readRecordValue({ source, key: 'name' });
  return typeof name === 'string' ? name.toLowerCase() : '';
};

const includesAnyToken = ({
  text,
  tokens
}: {
  text: string;
  tokens: ReadonlyArray<string>;
}): boolean => tokens.some(token => text.includes(token));

const hasTokenMatch = ({
  texts,
  tokens
}: {
  texts: ReadonlyArray<string>;
  tokens: ReadonlyArray<string>;
}): boolean =>
  texts.some(text =>
    includesAnyToken({
      text,
      tokens
    })
  );

const hasRegexMatch = ({
  texts,
  pattern
}: {
  texts: ReadonlyArray<string>;
  pattern: RegExp;
}): boolean => texts.some(text => pattern.test(text));

const getErrorLineage = (error: unknown): Array<unknown> => {
  const lineage: Array<unknown> = [];
  let current: unknown = error;

  for (let depth = 0; depth < maxErrorLineageDepth; depth += 1) {
    if (
      current === undefined ||
      current === null ||
      lineage.includes(current)
    ) {
      break;
    }

    lineage.push(current);
    current = getErrorCause(current);
  }

  return lineage;
};

const getResolverContext = (error: unknown): ResolverContext => {
  const lineage = getErrorLineage(error);
  const normalizedMessages = lineage
    .map(getNormalizedMessageFromSource)
    .filter(message => message.length > 0);
  const normalizedNames = lineage
    .map(getNormalizedNameFromSource)
    .filter(name => name.length > 0);
  const statusCodes = lineage.flatMap(getStatusCodesFromSource);
  const normalizedCodes = lineage.flatMap(getNormalizedCodesFromSource);

  return {
    error,
    normalizedMessages,
    normalizedNames,
    statusCodes,
    normalizedCodes
  };
};

const categoryMatcherByCategory: Record<
  NonGenericQueryErrorCategory,
  (context: ResolverContext) => boolean
> = {
  vaultState: context =>
    context.error instanceof VaultLockedError ||
    context.error instanceof VaultCorruptedError ||
    context.error instanceof NoPasswordSetError ||
    context.error instanceof IncorrectPasswordError ||
    context.error instanceof KeyDerivationError ||
    context.normalizedNames.some(name => vaultStateErrorNames.has(name)) ||
    hasTokenMatch({
      texts: context.normalizedMessages,
      tokens: [
        'vault is locked',
        'vault data is corrupted',
        'incorrect password',
        'key derivation failed'
      ]
    }),
  envMisconfigured: context =>
    context.error instanceof MissingChainError ||
    context.error instanceof CsprngUnavailableError ||
    context.normalizedNames.some(name => envErrorNames.has(name)) ||
    hasTokenMatch({
      texts: context.normalizedMessages,
      tokens: envMessageTokens
    }) ||
    hasRegexMatch({
      texts: context.normalizedMessages,
      pattern: envVarPattern
    }),
  rateLimited: context =>
    context.statusCodes.some(statusCode =>
      rateLimitStatusCodes.has(statusCode)
    ) ||
    hasTokenMatch({
      texts: context.normalizedMessages,
      tokens: rateLimitMessageTokens
    }),
  rpcUnavailable: context =>
    context.statusCodes.some(statusCode => rpcStatusCodes.has(statusCode)) ||
    hasTokenMatch({
      texts: context.normalizedMessages,
      tokens: rpcUnavailableMessageTokens
    }),
  networkConnectivity: context =>
    context.normalizedCodes.some(code => networkCodeTokens.has(code)) ||
    hasTokenMatch({
      texts: context.normalizedMessages,
      tokens: networkMessageTokens
    })
};

export const resolveQueryErrorCategory = (
  error: unknown
): QueryErrorCategory => {
  const contextResult = attempt(() => getResolverContext(error));
  if ('error' in contextResult) {
    return 'generic';
  }

  const context = contextResult.data;

  for (const category of categoryResolutionOrder) {
    if (categoryMatcherByCategory[category](context)) {
      return category;
    }
  }

  return 'generic';
};

export const resolveQueryErrorMessage = (error: unknown): string =>
  toastMessages[
    queryErrorMessageKeyByCategory[resolveQueryErrorCategory(error)]
  ];
