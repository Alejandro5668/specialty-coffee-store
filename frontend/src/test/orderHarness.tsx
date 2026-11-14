import { act, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CoffeeApi } from '../api/client';
import { TransactionStatus, TransactionView } from '../api/types';
import { ServicesProvider } from '../app/services';
import { createStore } from '../app/store';
import { OrderContainer } from '../features/order/containers/OrderContainer';
import { CheckoutState } from '../store/checkoutState';
import { fakeApi } from './fakeApi';
import { draft, NOW } from './state';
import { memoryStorage } from './storage';
import { coffee } from './summaryHarness';

export const orderView = (status: TransactionStatus, id = 'order-1'): TransactionView => ({
  id,
  status,
  variantId: 'huila-washed-250',
  quantity: 2,
  amounts: {
    currency: 'COP',
    productAmountInCents: 6_400_000,
    baseFeeInCents: 300_000,
    deliveryFeeInCents: 800_000,
    totalInCents: 7_500_000,
  },
  createdAt: '2026-01-01T00:00:00.000Z',
});

type Setup = {
  path?: string;
  api?: Partial<CoffeeApi>;
  state?: CheckoutState;
  poll?: { intervalMs: number; maxChecks: number };
  autoReturnMs?: number;
  fakeTimers?: boolean;
};

export const setupOrder = ({
  path = '/order/order-1',
  api = {},
  state = draft({ orderId: 'order-1', card: null }),
  poll = { intervalMs: 5, maxChecks: 5 },
  autoReturnMs,
  fakeTimers = false,
}: Setup = {}) => {
  const storage = memoryStorage(JSON.stringify({ v: 2, checkout: state }));
  const store = createStore({
    api: fakeApi({ listProducts: async () => [coffee()], ...api }),
    storage,
    now: () => NOW,
    newId: () => 'key-new-0001',
  });
  const user = userEvent.setup(
    fakeTimers ? { advanceTimers: jest.advanceTimersByTime } : undefined,
  );
  const utils = render(
    <Provider store={store}>
      <ServicesProvider
        value={{ tokenizer: { tokenize: jest.fn() }, now: () => NOW, poll, autoReturnMs }}
      >
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/" element={<p>Catalog page</p>} />
            <Route path="/checkout/details" element={<p>Details step</p>} />
            <Route path="/order/:id" element={<OrderContainer />} />
          </Routes>
        </MemoryRouter>
      </ServicesProvider>
    </Provider>,
  );
  return {
    store,
    user,
    storage,
    ...utils,
    tick: (ms: number) => act(() => void jest.advanceTimersByTime(ms)),
  };
};
