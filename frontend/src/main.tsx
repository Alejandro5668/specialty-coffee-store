import '@fontsource-variable/bricolage-grotesque/wdth.css';
import './styles/tokens.css';
import './styles/base.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { createCoffeeApi } from './api/client';
import { App } from './app/App';
import { createStore } from './app/store';

const api = createCoffeeApi(import.meta.env.VITE_API_URL ?? '/api', window.fetch.bind(window));
const store = createStore({ api, storage: window.localStorage });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </StrictMode>,
);
