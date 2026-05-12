import { CurrencyContext } from '@/lib/currency-context';
import { useContext } from 'react';

export const useCurrency = () => useContext(CurrencyContext);
