export const capitalizeFirstLetter = <T extends string>(
  text: T
): Capitalize<T> =>
  (text.charAt(0).toUpperCase() + text.slice(1)) as Capitalize<T>;

export const areLowerCaseEqual = (a: string, b: string): boolean =>
  a.toLowerCase() === b.toLowerCase();

export const normalizeNonEmptyString = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

type TruncateInput = {
  text: string;
  maxLength: number;
  suffix?: string;
};

export const truncate = ({
  text,
  maxLength,
  suffix = '...'
}: TruncateInput): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length) + suffix;
};
