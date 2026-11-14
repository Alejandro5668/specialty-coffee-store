import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApiError, CoffeeApi } from '../../../api/client';
import { ProductView } from '../../../api/types';
import { createStore } from '../../../app/store';
import { loadCatalog } from '../../../store/catalogSlice';
import { PERSIST_KEY } from '../../../store/persistence';
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
const catalog = [
  coffee('huila', 'Huila Washed', [20, 3]),
  coffee('narino', 'Nariño Honey', [0, 0]),
];

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
  const store = createStore({ api: { listProducts }, storage });
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
    expect(screen.getByRole('status')).toHaveTextContent('Loading coffees');
    expect(await screen.findByRole('heading', { name: 'Huila Washed' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nariño Honey' })).toBeInTheDocument();
    expect(screen.queryByText('Loading coffees')).not.toBeInTheDocument();
  });

  it('says what happened when the store cannot be reached and lets the shopper retry', async () => {
    let fail = true;
    setup(async () => {
      if (fail)
        throw new ApiError(
          0,
          'NETWORK',
          'We could not reach the store. Check your connection and try again.',
        );
      return catalog;
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not reach the store.');
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Huila Washed' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('invites the shopper to come back when there are no coffees', async () => {
    setup(async () => []);
    expect(
      await screen.findByText('No coffees are available right now. Check back soon.'),
    ).toBeInTheDocument();
  });

  it('computes the price from the chosen size and quantity', async () => {
    setup(async () => catalog);
    await screen.findByRole('heading', { name: 'Huila Washed' });
    const huila = card('Huila Washed');
    expect(huila.getByTestId('coffee-total')).toHaveTextContent('$32.000');
    await userEvent.click(huila.getByRole('button', { name: 'Increase quantity' }));
    expect(huila.getByTestId('coffee-total')).toHaveTextContent('$64.000');
    await userEvent.click(huila.getByRole('radio', { name: /500 g/ }));
    expect(huila.getByTestId('coffee-total')).toHaveTextContent('$116.000');
    expect(huila.getByText('Only 3 left')).toBeInTheDocument();
  });

  it('never lets the quantity exceed the stock of the size the shopper switches to', async () => {
    setup(async () => catalog);
    await screen.findByRole('heading', { name: 'Huila Washed' });
    const huila = card('Huila Washed');
    for (let i = 0; i < 6; i++)
      await userEvent.click(huila.getByRole('button', { name: 'Increase quantity' }));
    expect(huila.getByRole('status')).toHaveTextContent('7');
    await userEvent.click(huila.getByRole('radio', { name: /500 g/ }));
    expect(huila.getByRole('status')).toHaveTextContent('3');
    expect(huila.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
  });

  it('cannot buy a sold out coffee', async () => {
    setup(async () => catalog);
    await screen.findByRole('heading', { name: 'Nariño Honey' });
    const narino = card('Nariño Honey');
    expect(narino.getByRole('button', { name: 'Pay with credit card' })).toBeDisabled();
    expect(narino.getAllByText(/sold out/i).length).toBeGreaterThan(0);
  });

  it('saves the selection and goes on to the card step when the shopper pays', async () => {
    const { store, storage } = setup(async () => catalog);
    await screen.findByRole('heading', { name: 'Huila Washed' });
    const huila = card('Huila Washed');
    await userEvent.click(huila.getByRole('button', { name: 'Increase quantity' }));
    await userEvent.click(huila.getByRole('button', { name: 'Pay with credit card' }));
    expect(await screen.findByText('Details step')).toBeInTheDocument();
    expect(store.getState().checkout).toEqual({ variantId: 'huila-250', quantity: 2 });
    expect(storage.data.get(PERSIST_KEY)).toContain('"variantId":"huila-250"');
  });

  it('recovers the selection after a refresh', async () => {
    setup(async () => catalog, memory({ v: 1, checkout: { variantId: 'huila-500', quantity: 2 } }));
    await screen.findByRole('heading', { name: 'Huila Washed' });
    const huila = card('Huila Washed');
    expect(huila.getByRole('radio', { name: /500 g/ })).toBeChecked();
    expect(huila.getByRole('status')).toHaveTextContent('2');
    expect(huila.getByTestId('coffee-total')).toHaveTextContent('$116.000');
  });

  it('never trusts an amount from storage: the price always comes from the catalog', async () => {
    const edited = { v: 1, checkout: { variantId: 'huila-250', quantity: 1 }, price: 1, total: 1 };
    setup(async () => catalog, memory(edited));
    await screen.findByRole('heading', { name: 'Huila Washed' });
    expect(card('Huila Washed').getByTestId('coffee-total')).toHaveTextContent('$32.000');
  });

  it('ignores a saved selection for a size that no longer exists', async () => {
    setup(async () => catalog, memory({ v: 1, checkout: { variantId: 'gone-250', quantity: 4 } }));
    await screen.findByRole('heading', { name: 'Huila Washed' });
    const huila = card('Huila Washed');
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
    await screen.findByRole('heading', { name: 'Huila Washed' });
    await store.dispatch(loadCatalog());
    expect(await screen.findByText(/could not refresh the stock/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Huila Washed' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('skips a coffee that has no sizes instead of crashing', async () => {
    setup(async () => [{ ...coffee('empty', 'No Sizes', [1, 1]), variants: [] }, ...catalog]);
    expect(await screen.findByRole('heading', { name: 'Huila Washed' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'No Sizes' })).not.toBeInTheDocument();
  });
});
