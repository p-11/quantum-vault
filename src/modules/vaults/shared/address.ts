/**
 * Compact address helper used in Home list rows and Vault Detail headers.
 * Matches the original Figma shortening: 6/5 for `0x`, 4/5 otherwise.
 */
export const shortenVaultAddress = (address: string): string => {
  if (address.startsWith('0x')) {
    return `${address.slice(0, 6)}...${address.slice(-5)}`;
  }

  return `${address.slice(0, 4)}...${address.slice(-5)}`;
};
