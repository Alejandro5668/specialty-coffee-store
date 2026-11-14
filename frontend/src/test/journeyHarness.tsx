import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { OrderRequest, TransactionView } from '../api/types';
import { App } from '../app/App';
import { ServicesProvider } from '../app/services';
import { createStore } from '../app/store';
import { fakeApi } from './fakeApi';
import { NOW } from './state';
import { memoryStorage } from './storage';
import { coffee, options } from './summaryHarness';

/** The browser's Back button, and the address it is on. */
const HistoryProbe = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <>
      <button type="button" onClick={() => navigate(-1)}>
        Browser back
      </button>
      <p data-testid="path">{pathname}</p>
    </>
  );
};

export const CVC = '737';
export const PAN = '4242424242424242';

/** A tiny shop on the other side of the API: it keeps the stock and the orders, and answers like the real one. */
export const makeShop = () => {
  const shop = {
    stock500: 3,
    orders: new Map<string, TransactionView>(),
    requests: [] as OrderRequest[],
    polls: 0,
    hold: false,
  };
  const view = (id: string, status: TransactionView['status']): TransactionView => ({
    id,
    status,
    variantId: 'huila-washed-500',
    quantity: 2,
    amounts: {
      currency: 'COP',
      productAmountInCents: 11_600_000,
      baseFeeInCents: 300_000,
      deliveryFeeInCents: 800_000,
      totalInCents: 12_700_000,
    },
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  const api = fakeApi({
    listProducts: async () => [coffee([20, shop.stock500])],
    getCheckoutOptions: async () => options,
    createOrder: async (request) => {
      shop.requests.push(request);
      if (shop.hold) return new Promise<TransactionView>(() => undefined);
      const known = shop.orders.get(request.idempotencyKey);
      if (known) return known; // same key, same order, no second charge
      shop.stock500 -= request.quantity;
      const created = view('order-1', 'PENDING');
      shop.orders.set(request.idempotencyKey, created);
      return created;
    },
    getTransaction: async (id) => view(id, ++shop.polls < 2 ? 'PENDING' : 'APPROVED'),
  });
  return { shop, api };
};

export const makeApp = (api = makeShop().api) => {
  const storage = memoryStorage();
  const tokenizer = {
    tokenize: jest.fn(async () => ({
      token: 'tok_test_123456',
      brand: 'visa' as const,
      last4: '4242',
    })),
  };
  let keys = 0;
  const newId = () => `key-journey-${String(++keys).padStart(4, '0')}`;
  const services = {
    tokenizer,
    now: () => NOW,
    poll: { intervalMs: 5, maxChecks: 40 },
    autoReturnMs: 0,
  };

  const mount = (path: string) => {
    const store = createStore({ api, storage, now: () => NOW, newId });
    const ui = (
      <Provider store={store}>
        <ServicesProvider value={services}>
          <MemoryRouter initialEntries={[path]}>
            <App />
          </MemoryRouter>
        </ServicesProvider>
      </Provider>
    );
    return { store, ...render(ui) };
  };

  /** Starts with a browser history already built, and gives the test the browser's Back button. */
  const mountWithHistory = (entries: string[]) => {
    const store = createStore({ api, storage, now: () => NOW, newId });
    render(
      <Provider store={store}>
        <ServicesProvider value={services}>
          <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
            <HistoryProbe />
            <App />
          </MemoryRouter>
        </ServicesProvider>
      </Provider>,
    );
    return { store };
  };

  return { storage, tokenizer, mount, mountWithHistory, user: userEvent.setup() };
};

export const everythingEverStored = (storage: ReturnType<typeof memoryStorage>): string =>
  [...storage.setItem.mock.calls.map((c) => c[1]), ...storage.data.values()].join('\n');

export const choose500gTwice = async (user: ReturnType<typeof userEvent.setup>) => {
  const card = within(
    (await screen.findByRole('heading', { name: 'Huila Washed' })).closest('article')!,
  );
  await user.click(card.getByRole('radio', { name: /500 g/ }));
  await user.click(card.getByRole('button', { name: 'Aumentar cantidad' }));
  await user.click(card.getByRole('button', { name: 'Pagar con tarjeta de crédito' }));
};

export const fillTheForm = async (user: ReturnType<typeof userEvent.setup>) => {
  await screen.findByRole('link', { name: 'términos y condiciones' });
  const type = async (label: string, text: string) => {
    await user.clear(screen.getByLabelText(label));
    await user.type(screen.getByLabelText(label), text);
  };
  await type('Número de tarjeta', PAN);
  await type('Fecha de vencimiento', '1230');
  await type('Código de seguridad', CVC);
  await type('Nombre en la tarjeta', 'Ana Pérez');
  await type('Nombre completo', 'Ana Pérez');
  await type('Correo electrónico', 'ana@example.com');
  await type('Nombre del destinatario (opcional)', 'Ana Pérez');
  await type('Dirección', 'Calle 10 # 5-20');
  await type('Ciudad', 'Medellín');
  await type('Teléfono', '300 123 4567');
  for (const name of [/términos y condiciones/i, /datos personales/i]) {
    const box = screen.getByRole('checkbox', { name });
    if (!(box as HTMLInputElement).checked) await user.click(box);
  }
  await user.click(screen.getByRole('button', { name: 'Continuar al resumen' }));
};
