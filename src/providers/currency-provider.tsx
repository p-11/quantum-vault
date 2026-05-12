import { type CurrencyCode, loadCurrency, saveCurrency } from '@/lib/currency';
import { CurrencyContext } from '@/lib/currency-context';
import { useEffect, useState, type ReactNode } from 'react';

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [currency, setCurrencyState] = useState<CurrencyCode>('usd');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setCurrencyState(loadCurrency());
    setIsLoading(false);
  }, []);

  const setCurrency = (code: CurrencyCode) => {
    setCurrencyState(code);
    saveCurrency(code);
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, isLoading }}>
      {children}
    </CurrencyContext.Provider>
  );
};
