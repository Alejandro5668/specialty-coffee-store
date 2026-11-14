import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CardTokenizer } from '../api/tokenizer';
import { CheckoutOptions } from '../api/types';
import { createStore } from '../app/store';
import { ServicesProvider } from '../app/services';
import { selectCoffee } from '../store/checkoutSlice';
import { fakeApi } from './fakeApi';
import { NOW } from './state';
import { memoryStorage } from './storage';
import { DetailsContainer } from '../features/checkout/containers/DetailsContainer';

export const options: CheckoutOptions = {
  acceptance: { token: 'acc', permalink: 'https://example.test/terms.pdf' },
  personalData: { token: 'per', permalink: 'https://example.test/data.pdf' },
  fees: { currency: 'COP', baseFeeInCents: 300_000, deliveryFeeInCents: 800_000 },
  maxQuantity: 10,
};
export const NUMBER = '4242 4242 4242 4242';
export const CVC = '737';

export const setup = async (
  opts: {
    selected?: boolean;
    tokenizer?: CardTokenizer['tokenize'];
    getCheckoutOptions?: () => Promise<CheckoutOptions>;
    prepare?: (s: ReturnType<typeof createStore>) => void;
  } = {},
) => {
  const tokenize = jest.fn(
    opts.tokenizer ??
      (async () => ({ token: 'tok_test_123456', brand: 'visa' as const, last4: '4242' })),
  );
  const storage = memoryStorage();
  const store = createStore({
    api: fakeApi({ getCheckoutOptions: opts.getCheckoutOptions ?? (async () => options) }),
    storage,
    now: () => NOW,
    newId: () => 'key-new-0001',
  });
  if (opts.selected !== false)
    store.dispatch(selectCoffee({ variantId: 'huila-washed-250', quantity: 2 }));
  opts.prepare?.(store);
  const dispatchSpy = jest.spyOn(store, 'dispatch');
  const user = userEvent.setup();
  render(
    <Provider store={store}>
      <ServicesProvider value={{ tokenizer: { tokenize }, now: () => NOW }}>
        <MemoryRouter initialEntries={['/checkout/details']}>
          <Routes>
            <Route path="/" element={<p>Catalog page</p>} />
            <Route path="/checkout/details" element={<DetailsContainer />} />
            <Route path="/checkout/summary" element={<p>Summary step</p>} />
            <Route path="/order/:id" element={<p>Order page</p>} />
          </Routes>
        </MemoryRouter>
      </ServicesProvider>
    </Provider>,
  );
  return { store, storage, tokenize, user, dispatchSpy };
};

export const fillCard = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('Card number'), NUMBER);
  await user.type(screen.getByLabelText('Expiry date'), '1230');
  await user.type(screen.getByLabelText('Security code'), CVC);
  await user.type(screen.getByLabelText('Name on the card'), 'Ana Pérez');
};
export const fillPerson = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('Full name'), 'Ana Pérez');
  await user.type(screen.getByLabelText('Email'), 'ana@example.com');
  await user.type(screen.getByLabelText('Recipient name (optional)'), 'Ana Pérez');
  await user.type(screen.getByLabelText('Address'), 'Calle 10 # 5-20');
  await user.type(screen.getByLabelText('City'), 'Medellín');
  await user.type(screen.getByLabelText('Phone'), '300 123 4567');
};
export const accept = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('checkbox', { name: /terms and conditions/i }));
  await user.click(screen.getByRole('checkbox', { name: /personal data/i }));
};
export const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Continue to summary' }));
export const ready = () => screen.findByRole('link', { name: 'terms and conditions' });
