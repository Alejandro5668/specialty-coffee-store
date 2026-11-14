import '@fontsource-variable/bricolage-grotesque/wdth.css';
import './styles/tokens.css';
import './styles/base.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { createCoffeeApi } from './api/client';
import { createCardTokenizer, unavailableTokenizer } from './api/tokenizer';
import { App } from './app/App';
import { ServicesProvider } from './app/services';
import { createStore } from './app/store';

const api = createCoffeeApi(import.meta.env.VITE_API_URL ?? '/api', window.fetch.bind(window));
const store = createStore({ api, storage: window.localStorage });

// The card goes from the browser straight to the payment service, so it needs its own address and
// public key. Without them the form says so instead of failing in a strange way.
const paymentUrl = import.meta.env.VITE_PAYMENT_API_URL;
const publicKey = import.meta.env.VITE_PAYMENT_PUBLIC_KEY;
const tokenizer =
  paymentUrl && publicKey
    ? createCardTokenizer(paymentUrl, publicKey, window.fetch.bind(window))
    : unavailableTokenizer;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <ServicesProvider value={{ tokenizer, now: Date.now }}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ServicesProvider>
    </Provider>
  </StrictMode>,
);
