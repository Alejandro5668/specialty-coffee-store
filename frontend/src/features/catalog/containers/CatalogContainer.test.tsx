import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApiError, CoffeeApi } from '../../../api/client';
import { ProductView } from '../../../api/types';
import { createStore } from '../../../app/store';
import { fakeApi } from '../../../test/fakeApi';
import { loadCatalog } from '../../../store/catalogSlice';
import { initialCheckout } from '../../../store/checkoutState';
import { PERSIST_KEY, toPersistable } from '../../../store/persistence';
import { CatalogContainer } from './CatalogContainer';

const coffee = (id: string, name: string, stocks: [number, number]): ProductView => ({
  id,
  name,
  description: `${name} notes`,
  imageUrl: `/images/coffees/${id}.webp`,
  variants: [
    { id: `${id}-250`, sizeGrams: 250, priceInCents: 3_200_000, currency: 'COP', stock: stocks[0] },
    { id: `${id}-500`, sizeGrams: 500, priceInCents: 5_800_000, currency: 'COP', stock: stocks[1] },
  ],
});
const catalog = [coffee('huila', 'Huila Lavado', [20, 3]), coffee('narino', 'Nariño Miel', [0, 0])];

/** What the app saves in the browser for a shopper who chose a coffee. */
const v2 = (over: Record<string, unknown>) => ({
  v: 2,
  checkout: toPersistable({ ...initialCheckout, ...over }),
});

const memory = (saved?: unknown) => {
  const data = new Map<string, string>();
  if (saved !== undefined) data.set(PERSIST_KEY, JSON.stringify(saved));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
};

const setup = (listProducts: CoffeeApi['listProducts'], storage = memory()) => {
  const store = createStore({ api: fakeApi({ listProducts }), storage });
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<CatalogContainer />} />
          <Route path="/checkout/details" element={<p>Details step</p>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
  return { store, storage };
};
const card = (name: string) => within(screen.getByRole('heading', { name }).closest('article')!);

describe('CatalogContainer', () => {
  it('shows a loading state, then the coffees', async () => {
    setup(async () => catalog);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando cafés');
    expect(await screen.findByRole('heading', { name: 'Huila Lavado' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nariño Miel' })).toBeInTheDocument();
    expect(screen.queryByText('Cargando cafés')).not.toBeInTheDocument();
  });

  it('says what happened when the store cannot be reached and lets the shopper retry', async () => {
    let fail = true;
    setup(async () => {
      if (fail)
        throw new ApiError(
          0,
          'NETWORK',
          'No pudimos conectar con la tienda. Revisa tu conexión e inténtalo de nuevo.',
        );
      return catalog;
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos conectar con la tienda.',
    );
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Intentar de nuevo' }));
    expect(await screen.findByRole('heading', { name: 'Huila Lavado' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('invites the shopper to come back when there are no coffees', async () => {
    setup(async () => []);
    expect(
      await screen.findByText('No hay cafés disponibles en este momento. Vuelve pronto.'),
    ).toBeInTheDocument();
  });

  it('computes the price from the chosen size and quantity', async () => {
    setup(async () => catalog);
    await screen.findByRole('heading', { name: 'Huila Lavado' });
    const huila = card('Huila Lavado');
    expect(huila.getByTestId('coffee-total')).toHaveTextContent('$32.000');
    await userEvent.click(huila.getByRole('button', { name: 'Aumentar cantidad' }));
    expect(huila.getByTestId('coffee-total')).toHaveTextContent('$64.000');
    await userEvent.click(huila.getByRole('radio', { name: /500 g/ }));
    expect(huila.getByTestId('coffee-total')).toHaveTextContent('$116.000');
    expect(huila.getByText('Quedan 3')).toBeInTheDocument();
  });

  it('never lets the quantity exceed the stock of the size the shopper switches to', async () => {
    setup(async () => catalog);
    await screen.findByRole('heading', { name: 'Huila Lavado' });
    const huila = card('Huila Lavado');
    for (let i = 0; i < 6; i++)
      await userEvent.click(huila.getByRole('button', { name: 'Aumentar cantidad' }));
    expect(huila.getByRole('status')).toHaveTextContent('7');
    await userEvent.click(huila.getByRole('radio', { name: /500 g/ }));
    expect(huila.getByRole('status')).toHaveTextContent('3');
    expect(huila.getByRole('button', { name: 'Aumentar cantidad' })).toBeDisabled();
  });

  it('cannot buy a sold-out coffee', async () => {
    setup(async () => catalog);
    await screen.findByRole('heading', { name: 'Nariño Miel' });
    const narino = card('Nariño Miel');
    expect(narino.getByRole('button', { name: 'Pagar con tarjeta de crédito' })).toBeDisabled();
    expect(narino.getAllByText(/agotado/i).length).toBeGreaterThan(0);
  });

  it('saves the selection and goes on to the card step when the shopper pays', async () => {
    const { store, storage } = setup(async () => catalog);
    await screen.findByRole('heading', { name: 'Huila Lavado' });
    const huila = card('Huila Lavado');
    await userEvent.click(huila.getByRole('button', { name: 'Aumentar cantidad' }));
    await userEvent.click(huila.getByRole('button', { name: 'Pagar con tarjeta de crédito' }));
    expect(await screen.findByText('Details step')).toBeInTheDocument();
    expect(store.getState().checkout).toMatchObject({ variantId: 'huila-250', quantity: 2 });
    expect(storage.data.get(PERSIST_KEY)).toContain('"variantId":"huila-250"');
  });

  it('recovers the selection after a refresh', async () => {
    setup(async () => catalog, memory(v2({ variantId: 'huila-500', quantity: 2 })));
    await screen.findByRole('heading', { name: 'Huila Lavado' });
    const huila = card('Huila Lavado');
    expect(huila.getByRole('radio', { name: /500 g/ })).toBeChecked();
    expect(huila.getByRole('status')).toHaveTextContent('2');
    expect(huila.getByTestId('coffee-total')).toHaveTextContent('$116.000');
  });

  it('never trusts an amount from storage: the price always comes from the catalog', async () => {
    const edited = { ...v2({ variantId: 'huila-250', quantity: 1 }), price: 1, total: 1 };
    setup(async () => catalog, memory(edited));
    await screen.findByRole('heading', { name: 'Huila Lavado' });
    expect(card('Huila Lavado').getByTestId('coffee-total')).toHaveTextContent('$32.000');
  });

  it('ignores a saved selection for a size that no longer exists', async () => {
    setup(async () => catalog, memory(v2({ variantId: 'gone-250', quantity: 4 })));
    await screen.findByRole('heading', { name: 'Huila Lavado' });
    const huila = card('Huila Lavado');
    expect(huila.getByRole('radio', { name: /250 g/ })).toBeChecked();
    expect(huila.getByRole('status')).toHaveTextContent('1');
  });

  it('keeps the list and says so when the stock cannot be refreshed', async () => {
    const answers: Array<() => Promise<ProductView[]>> = [
      async () => catalog,
      async () => {
        throw new ApiError(503, 'X', 'Try again in a minute.');
      },
    ];
    const { store } = setup(() => answers.shift()!());
    await screen.findByRole('heading', { name: 'Huila Lavado' });
    await store.dispatch(loadCatalog());
    expect(await screen.findByText(/No pudimos actualizar el stock/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Huila Lavado' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('skips a coffee that has no sizes instead of crashing', async () => {
    setup(async () => [{ ...coffee('empty', 'No Sizes', [1, 1]), variants: [] }, ...catalog]);
    expect(await screen.findByRole('heading', { name: 'Huila Lavado' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'No Sizes' })).not.toBeInTheDocument();
  });
});
