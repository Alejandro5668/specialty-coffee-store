import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CoffeeApi } from '../api/client';
import { CheckoutOptions, ProductView, TransactionView } from '../api/types';
import { ServicesProvider } from '../app/services';
import { createStore } from '../app/store';
import { SummaryContainer } from '../features/checkout/containers/SummaryContainer';
import { loadCatalog } from '../store/catalogSlice';
import { loadOptions } from '../store/optionsSlice';
import { CheckoutState } from '../store/checkoutState';
import { fakeApi } from './fakeApi';
import { draft, NOW } from './state';
import { memoryStorage } from './storage';

export const options: CheckoutOptions = {
  acceptance: { token: 'acc_fresh', permalink: 'https://example.test/terms.pdf' },
  personalData: { token: 'per_fresh', permalink: 'https://example.test/data.pdf' },
  fees: { currency: 'COP', baseFeeInCents: 300_000, deliveryFeeInCents: 800_000 },
  maxQuantity: 10,
};

export const coffee = (stocks: [number, number] = [20, 3]): ProductView => ({
  id: 'huila-washed',
  name: 'Huila Lavado',
  description: 'Caramel.',
  imageUrl: '/images/coffees/huila-washed.webp',
  variants: [
    {
      id: 'huila-washed-250',
      sizeGrams: 250,
      priceInCents: 3_200_000,
      currency: 'COP',
      stock: stocks[0],
    },
    {
      id: 'huila-washed-500',
      sizeGrams: 500,
      priceInCents: 5_800_000,
      currency: 'COP',
      stock: stocks[1],
    },
  ],
});

export const placed = (id = 'order-1'): TransactionView => ({
  id,
  status: 'PENDING',
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
  state?: CheckoutState;
  catalog?: ProductView[] | 'pending';
  api?: Partial<CoffeeApi>;
  /** The fees were already loaded while the shopper filled the form. */
  optionsLoaded?: boolean;
};

export const setupSummary = async ({
  state = draft(),
  catalog = [coffee()],
  api = {},
  optionsLoaded = false,
}: Setup = {}) => {
  const storage = memoryStorage(JSON.stringify({ v: 2, checkout: state }));
  const store = createStore({
    api: fakeApi({
      listProducts: async () =>
        catalog === 'pending' ? new Promise<ProductView[]>(() => undefined) : catalog,
      getCheckoutOptions: async () => options,
      ...api,
    }),
    storage,
    now: () => NOW,
    newId: () => 'key-new-0001',
  });
  const user = userEvent.setup();
  if (optionsLoaded) await store.dispatch(loadOptions());
  render(
    <Provider store={store}>
      <ServicesProvider value={{ tokenizer: { tokenize: jest.fn() }, now: () => NOW }}>
        <MemoryRouter initialEntries={['/checkout/summary']}>
          <Routes>
            <Route path="/" element={<p>Catalog page</p>} />
            <Route path="/checkout/details" element={<p>Details step</p>} />
            <Route path="/checkout/summary" element={<SummaryContainer />} />
            <Route path="/order/:id" element={<p>Order page</p>} />
          </Routes>
        </MemoryRouter>
      </ServicesProvider>
    </Provider>,
  );
  // The coffees behind the sheet load the catalog in the real app.
  if (catalog !== 'pending') await store.dispatch(loadCatalog());
  else void store.dispatch(loadCatalog());
  return { store, user };
};
