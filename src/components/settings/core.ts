import type { ComponentPropsWithoutRef, ComponentType } from 'react';

export type SettingsRowTone = 'default' | 'destructive';
export type SettingsRowIcon = ComponentType<ComponentPropsWithoutRef<'svg'>>;

export type SettingsRowConfig = {
  id: string;
  label: string;
  icon: SettingsRowIcon;
  tone?: SettingsRowTone;
  value?: string;
  testId?: string;
  isLoading?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};
