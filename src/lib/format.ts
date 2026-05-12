type FormatWalletAddressInput = {
  address: string;
  startChars?: number;
  endChars?: number;
};

export const formatWalletAddress = ({
  address,
  startChars = 6,
  endChars = 4
}: FormatWalletAddressInput): string => {
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};

/** Final segment length kept unbreakable for deposit address wrapping (ENG-1821). */
export const depositAddressWrapTailLength = 6;

export interface SplitAddressForDepositWrapInput {
  address: string;
  tailLength?: number;
}

export interface SplitAddressForDepositWrapResult {
  head: string;
  tail: string;
}

export const splitAddressForDepositWrap = ({
  address,
  tailLength = depositAddressWrapTailLength
}: SplitAddressForDepositWrapInput): SplitAddressForDepositWrapResult => {
  if (address.length <= tailLength) {
    return { head: address, tail: '' };
  }

  return {
    head: address.slice(0, -tailLength),
    tail: address.slice(-tailLength)
  };
};

const defaultSignificantDecimals = 2;
const defaultLocale = 'en-US';

type FormatAmountInput = {
  value: number;
  maxDecimals?: number;
  minDecimals?: number;
  locale?: string;
};

export const formatAmount = ({
  value,
  maxDecimals = 6,
  minDecimals = 0,
  locale = defaultLocale
}: FormatAmountInput): string => {
  if (value === 0) return '0';

  const absValue = Math.abs(value);

  const decimals =
    absValue >= 1
      ? Math.min(maxDecimals, defaultSignificantDecimals)
      : Math.min(
          maxDecimals,
          Math.max(
            minDecimals,
            -Math.floor(Math.log10(absValue)) + defaultSignificantDecimals
          )
        );

  return value.toLocaleString(locale, {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: decimals,
    useGrouping: true
  });
};
