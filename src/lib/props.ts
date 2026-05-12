import type { CSSProperties, ReactNode } from 'react';

export type ChildrenProp = { children: ReactNode };

export type ValueProp<T> = { value: T };

export type InputProps<T> = {
  value: T;
  onChange: (value: T) => void;
};

export type OnCloseProp = { onClose: () => void };

export type OnClickProp = { onClick: () => void };

export type OnFinishProp<T = void> = T extends void
  ? { onFinish: () => void }
  : { onFinish: (result: T) => void };

export type OnBackProp = { onBack: () => void };

export type RenderProp<T> = { render: (props: T) => ReactNode };

export type LabelProp = { label: ReactNode };

export type IsDisabledProp = { isDisabled?: boolean };

export type ItemsProp<T> = { items: readonly T[] };

export type RenderItemProp<T> = { renderItem: (item: T) => ReactNode };

export type GetItemKeyProp<T> = T extends string | number
  ? { getItemKey?: (item: T) => string | number }
  : { getItemKey: (item: T) => string | number };

export type UiProps = {
  style?: CSSProperties;
  className?: string;
};
