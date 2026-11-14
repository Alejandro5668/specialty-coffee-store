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
    now?: () => number;
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
      <ServicesProvider value={{ tokenizer: { tokenize }, now: opts.now ?? (() => NOW) }}>
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
  await user.type(screen.getByLabelText('Número de tarjeta'), NUMBER);
  await user.type(screen.getByLabelText('Fecha de vencimiento'), '1230');
  await user.type(screen.getByLabelText('Código de seguridad'), CVC);
  await user.type(screen.getByLabelText('Nombre en la tarjeta'), 'Ana Pérez');
};
export const fillPerson = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText('Nombre completo'), 'Ana Pérez');
  await user.type(screen.getByLabelText('Correo electrónico'), 'ana@example.com');
  await user.type(screen.getByLabelText('Nombre del destinatario (opcional)'), 'Ana Pérez');
  await user.type(screen.getByLabelText('Dirección'), 'Calle 10 # 5-20');
  await user.type(screen.getByLabelText('Ciudad'), 'Medellín');
  await user.type(screen.getByLabelText('Teléfono'), '300 123 4567');
};
export const accept = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('checkbox', { name: /términos y condiciones/i }));
  await user.click(screen.getByRole('checkbox', { name: /datos personales/i }));
};
export const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Continuar al resumen' }));
export const ready = () => screen.findByRole('link', { name: 'términos y condiciones' });
