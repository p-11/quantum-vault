import { withdrawFlowCopy } from '@/lib/copy';
import { isAddress } from '@project-eleven/libqc';

/**
 * Cheap shape check for Bitcoin mainnet destinations (legacy P2PKH/P2SH
 * base58 or bech32/bech32m). It rejects obvious mistakes up front - EVM
 * `0x` addresses, testnet `tb1` prefixes, stray characters - without
 * bundling a checksum implementation. libqc's `estimateEmptyVaultFee` /
 * `emptyVault` remain the authoritative validators and their rejection is
 * surfaced on the review step as `invalid-destination`.
 */
const bitcoinMainnetAddressPattern =
  /^(?:[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[ac-hj-np-z02-9]{11,87}|BC1[AC-HJ-NP-Z02-9]{11,87})$/;

const addressValidationByNamespace = {
  bip122: {
    getError: (destination: string) =>
      bitcoinMainnetAddressPattern.test(destination)
        ? null
        : withdrawFlowCopy.invalidBitcoinAddressError
  },
  eip155: {
    getError: (destination: string) =>
      isAddress(destination) ? null : withdrawFlowCopy.invalidEvmAddressError
  }
} as const;

type SupportedWithdrawNamespace = keyof typeof addressValidationByNamespace;

const isSupportedWithdrawNamespace = (
  namespace: string
): namespace is SupportedWithdrawNamespace =>
  namespace in addressValidationByNamespace;

export const getAddressValidationError = ({
  destination,
  namespace
}: {
  destination: string;
  namespace: string;
}): string | null => {
  if (!isSupportedWithdrawNamespace(namespace)) {
    throw new Error(`Unsupported withdraw namespace: ${namespace}`);
  }

  return addressValidationByNamespace[namespace].getError(destination);
};
