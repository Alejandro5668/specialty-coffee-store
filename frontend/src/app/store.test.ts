import { CoffeeApi } from '../api/client';
import { PERSIST_KEY } from '../store/persistence';
import { selectCoffee } from '../store/checkoutSlice';
import { loadCatalog } from '../store/catalogSlice';
import { createStore } from './store';

const api: CoffeeApi = { listProducts: async () => [] };
const memory = (initial?: string) => {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(PERSIST_KEY, initial);
  const setItem = jest.fn((k: string, v: string) => void data.set(k, v));
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem };
};

describe('createStore', () => {
  it('starts empty when nothing was saved', () => {
    const store = createStore({ api, storage: memory() });
    expect(store.getState()).toEqual({
      catalog: { status: 'idle', products: [], error: null },
      checkout: { variantId: null, quantity: 1 },
    });
  });

  it('recovers the selection after a refresh', () => {
    const saved = JSON.stringify({
      v: 1,
      checkout: { variantId: 'huila-washed-250', quantity: 2 },
    });
    const store = createStore({ api, storage: memory(saved) });
    expect(store.getState().checkout).toEqual({ variantId: 'huila-washed-250', quantity: 2 });
  });

  it('ignores an edited storage', () => {
    const edited = JSON.stringify({ v: 1, checkout: { variantId: '<b>x</b>', quantity: 999 } });
    expect(createStore({ api, storage: memory(edited) }).getState().checkout).toEqual({
      variantId: null,
      quantity: 1,
    });
  });

  it('saves the selection when it changes, and only then', async () => {
    const storage = memory();
    const store = createStore({ api, storage });
    await store.dispatch(loadCatalog());
    expect(storage.setItem).not.toHaveBeenCalled();
    store.dispatch(selectCoffee({ variantId: 'huila-washed-250', quantity: 3 }));
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(storage.data.get(PERSIST_KEY)).toContain('"quantity":3');
  });

  it('works without storage and when storage refuses to write', () => {
    const noStorage = createStore({ api, storage: null });
    expect(() => noStorage.dispatch(selectCoffee({ variantId: 'a', quantity: 1 }))).not.toThrow();
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const store = createStore({ api, storage: full });
    expect(() => store.dispatch(selectCoffee({ variantId: 'a', quantity: 1 }))).not.toThrow();
    expect(store.getState().checkout.variantId).toBe('a');
  });
});
