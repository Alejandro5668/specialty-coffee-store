import { configureStore } from '@reduxjs/toolkit';
import { ApiError, CoffeeApi } from '../api/client';
import { fakeApi } from '../test/fakeApi';
import { ProductView } from '../api/types';
import { catalogReducer, loadCatalog } from './catalogSlice';

const coffee: ProductView = {
  id: 'a',
  name: 'A',
  description: 'd',
  imageUrl: '/images/coffees/a.webp',
  variants: [{ id: 'a-250', sizeGrams: 250, priceInCents: 100, currency: 'COP', stock: 2 }],
};

const storeWith = (listProducts: CoffeeApi['listProducts']) =>
  configureStore({
    reducer: { catalog: catalogReducer },
    middleware: (gdm) =>
      gdm({
        thunk: {
          extraArgument: { api: fakeApi({ listProducts }), newId: () => 'x', now: () => 0 },
        },
      }),
  });

describe('catalog', () => {
  it('starts idle and empty', () => {
    expect(storeWith(async () => []).getState().catalog).toEqual({
      status: 'idle',
      products: [],
      error: null,
    });
  });

  it('shows loading, then the coffees', async () => {
    let release: (p: ProductView[]) => void = () => undefined;
    const store = storeWith(() => new Promise((resolve) => (release = resolve)));
    const pending = store.dispatch(loadCatalog());
    expect(store.getState().catalog.status).toBe('loading');
    release([coffee]);
    await pending;
    expect(store.getState().catalog).toEqual({ status: 'ready', products: [coffee], error: null });
  });

  it('keeps the coffees on screen while it refreshes the stock', async () => {
    let release: (p: ProductView[]) => void = () => undefined;
    const first = storeWith(async () => [coffee]);
    await first.dispatch(loadCatalog());
    const store = storeWith(() => new Promise((resolve) => (release = resolve)));
    store.dispatch({ type: loadCatalog.fulfilled.type, payload: [coffee] });
    const pending = store.dispatch(loadCatalog());
    expect(store.getState().catalog).toMatchObject({ status: 'loading', products: [coffee] });
    release([{ ...coffee, name: 'B' }]);
    await pending;
    expect(store.getState().catalog.products[0].name).toBe('B');
  });

  it('keeps the plain message of an API error', async () => {
    const store = storeWith(async () => {
      throw new ApiError(503, 'GATEWAY', 'Try again in a minute.');
    });
    await store.dispatch(loadCatalog());
    expect(store.getState().catalog).toMatchObject({
      status: 'failed',
      error: 'Try again in a minute.',
    });
  });

  it('never shows a raw error from the code', async () => {
    const store = storeWith(async () => {
      throw new TypeError("Cannot read properties of undefined (reading 'x')");
    });
    await store.dispatch(loadCatalog());
    expect(store.getState().catalog.error).toBe('Algo salió mal. Inténtalo de nuevo en un minuto.');
  });

  it('can retry after a failure', async () => {
    let fail = true;
    const store = storeWith(async () => {
      if (fail) throw new ApiError(0, 'NETWORK', 'No connection.');
      return [coffee];
    });
    await store.dispatch(loadCatalog());
    fail = false;
    await store.dispatch(loadCatalog());
    expect(store.getState().catalog).toEqual({ status: 'ready', products: [coffee], error: null });
  });
});
