import { fakeApi } from '../test/fakeApi';
import { memoryStorage } from '../test/storage';
import { draft, NOW } from '../test/state';
import { loadCatalog } from '../store/catalogSlice';
import { initialCheckout } from '../store/checkoutState';
import { selectCoffee, updateCustomer } from '../store/checkoutSlice';
import { PERSIST_KEY, toPersistable } from '../store/persistence';
import { createStore } from './store';

const api = fakeApi({ listProducts: async () => [] });
const make = (storage: Parameters<typeof createStore>[0]['storage']) =>
  createStore({ api, storage, now: () => NOW, newId: () => 'key-new-0001' });
const savedDraft = (state = draft()) => JSON.stringify({ v: 2, checkout: toPersistable(state) });

describe('createStore', () => {
  it('starts empty when nothing was saved', () => {
    expect(make(memoryStorage()).getState()).toEqual({
      catalog: { status: 'idle', products: [], error: null },
      options: { status: 'idle', data: null, error: null },
      order: { status: 'idle', forId: null, view: null, error: null, errorStatus: null },
      checkout: initialCheckout,
    });
  });

  it('recovers the whole draft after a refresh', () => {
    expect(make(memoryStorage(savedDraft())).getState().checkout).toEqual(draft());
  });

  it('drops a card token that has gone stale while the page was closed', () => {
    const stale = draft({
      card: { token: 'tok_test_123456', brand: 'visa', last4: '4242', at: NOW - 3_600_000 },
    });
    expect(make(memoryStorage(savedDraft(stale))).getState().checkout.card).toBeNull();
  });

  it('ignores an edited storage', () => {
    const edited = JSON.stringify({ v: 2, checkout: { variantId: '<b>x</b>', quantity: 999 } });
    expect(make(memoryStorage(edited)).getState().checkout).toEqual(initialCheckout);
  });

  it('saves the draft when it changes, and only then', async () => {
    const storage = memoryStorage();
    const store = make(storage);
    await store.dispatch(loadCatalog());
    expect(storage.setItem).not.toHaveBeenCalled();
    store.dispatch(selectCoffee({ variantId: 'huila-washed-250', quantity: 3 }));
    store.dispatch(updateCustomer({ name: 'Ana' }));
    expect(storage.setItem).toHaveBeenCalledTimes(2);
    expect(JSON.parse(storage.data.get(PERSIST_KEY)!).checkout).toMatchObject({
      quantity: 3,
      customer: { name: 'Ana' },
    });
  });

  it('works without storage and when storage refuses to write', () => {
    const noStorage = make(null);
    expect(() => noStorage.dispatch(selectCoffee({ variantId: 'a', quantity: 1 }))).not.toThrow();
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    const store = make(full);
    expect(() => store.dispatch(selectCoffee({ variantId: 'a', quantity: 1 }))).not.toThrow();
    expect(store.getState().checkout.variantId).toBe('a');
  });
});
