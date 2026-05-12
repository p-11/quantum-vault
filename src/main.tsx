import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { WalletProvider } from './providers/wallet-provider';
import { CurrencyProvider } from './providers/currency-provider';
import { QueryProvider } from './lib/query-client';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <CurrencyProvider>
        <WalletProvider>
          <App />
        </WalletProvider>
      </CurrencyProvider>
    </QueryProvider>
  </StrictMode>
);
