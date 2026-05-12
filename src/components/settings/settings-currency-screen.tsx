import type { ComponentPropsWithoutRef, ComponentType } from 'react';

import { useCurrency } from '@/hooks/use-currency';
import { useScreen } from '@/hooks/use-screen';
import { type CurrencyCode, supportedCurrencies } from '@/lib/currency';

import {
  EurCurrencyIcon,
  GbpCurrencyIcon,
  JpyCurrencyIcon,
  SelectedCurrencyCheckIcon,
  UsdCurrencyIcon
} from './icons';
import { SettingsPage } from './settings-page';

type CurrencyIcon = ComponentType<ComponentPropsWithoutRef<'svg'>>;

const currencyIcons: Record<CurrencyCode, CurrencyIcon> = {
  usd: UsdCurrencyIcon,
  eur: EurCurrencyIcon,
  gbp: GbpCurrencyIcon,
  jpy: JpyCurrencyIcon
};

export const SettingsCurrencyScreen = () => {
  const { navigate } = useScreen();
  const { currency, setCurrency } = useCurrency();

  return (
    <SettingsPage
      title='Currency'
      onBack={() => navigate('settings', { direction: 'back' })}
    >
      <div className='mt-4 border-y border-divider'>
        {supportedCurrencies.map(({ code, name }) => {
          const CurrencyIcon = currencyIcons[code];
          const isSelected = currency === code;

          return (
            <button
              key={code}
              type='button'
              aria-pressed={isSelected}
              data-selected={isSelected}
              className='flex h-[74px] w-full items-center gap-2 border-t border-divider px-4 text-left transition-colors first:border-t-0 hover:bg-accent/40'
              onClick={() => setCurrency(code)}
            >
              <span className='flex size-[42px] shrink-0 items-center justify-center bg-secondary text-foreground'>
                <CurrencyIcon className='size-5' />
              </span>

              <span className='min-w-0 flex-1 text-base font-normal leading-6 text-foreground'>
                {name}
              </span>

              <span className='flex size-6 shrink-0 items-center justify-center'>
                {isSelected && (
                  <SelectedCurrencyCheckIcon
                    aria-hidden='true'
                    data-testid={`currency-selected-check-${code}`}
                    className='size-6 text-selected-foreground'
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </SettingsPage>
  );
};
