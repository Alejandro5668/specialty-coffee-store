import { configureStore } from '@reduxjs/toolkit';
import { ApiError, CoffeeApi } from '../api/client';
import { CheckoutOptions, OrderRequest, TransactionView } from '../api/types';
import { fakeApi } from '../test/fakeApi';
import { draft, NOW } from '../test/state';
import { checkoutReducer } from './checkoutSlice';
import { OPTIONS_TTL_MS, optionsReducer, OptionsState } from './optionsSlice';
import { placeOrder } from './placeOrder';

const options: CheckoutOptions = {
  acceptance: { token: 'acc_fresh', permalink: 'https://example.test/t.pdf' },
  personalData: { token: 'per_fresh', permalink: 'https://example.test/d.pdf' },
  fees: { currency: 'COP', baseFeeInCents: 300_000, deliveryFeeInCents: 800_000 },
  maxQuantity: 10,
};
const placed = { id: 'order-1', status: 'PENDING' } as TransactionView;

const loaded = (at: number): OptionsState => ({
  status: 'ready',
  data: { ...options, acceptance: { ...options.acceptance, token: 'acc_prefetched' } },
  error: null,
  loadedAt: at,
});
const IDLE: OptionsState = { status: 'idle', data: null, error: null, loadedAt: null };

const setup = (api: Partial<CoffeeApi> = {}, prefetched: OptionsState = IDLE) => {
  const calls: OrderRequest[] = [];
  const store = configureStore({
    reducer: { checkout: checkoutReducer, options: optionsReducer },
    preloadedState: { checkout: draft(), options: prefetched },
    middleware: (gdm) =>
      gdm({
        thunk: {
          extraArgument: {
            now: () => NOW,
            newId: () => 'key-new-0001',
            api: fakeApi({
              getCheckoutOptions: async () => options,
              createOrder: async (request) => {
                calls.push(request);
                return placed;
              },
              ...api,
            }),
          },
        },
      }),
  });
  return { store, calls };
};

describe('placeOrder: tokens loaded earlier', () => {
  it('pays with the tokens loaded while the shopper typed, without asking the provider again', async () => {
    let fetched = 0;
    const { store, calls } = setup(
      { getCheckoutOptions: async () => (fetched++, options) },
      loaded(NOW - 60_000),
    );
    await store.dispatch(placeOrder());
    expect(fetched).toBe(0);
    expect(calls[0]).toMatchObject({
      acceptanceToken: 'acc_prefetched',
      personalAuthToken: 'per_fresh',
    });
  });

  it('uses them only once: the retry after a failed attempt gets new ones', async () => {
    let fetched = 0;
    let failNext = true;
    const { store, calls } = setup(
      {
        getCheckoutOptions: async () => (fetched++, options),
        createOrder: async (request) => {
          calls.push(request);
          if (failNext) {
            failNext = false;
            throw new ApiError(502, 'GATEWAY_UNAVAILABLE', 'Try again in a minute.');
          }
          return placed;
        },
      },
      loaded(NOW),
    );
    await store.dispatch(placeOrder());
    await store.dispatch(placeOrder());
    expect(fetched).toBe(1);
    expect(calls.map((c) => c.acceptanceToken)).toEqual(['acc_prefetched', 'acc_fresh']);
  });

  it('forgets them even when the payment fails, because the provider may have used them', async () => {
    const { store } = setup(
      {
        createOrder: async () => {
          throw new ApiError(502, 'GATEWAY_UNAVAILABLE', 'Try again in a minute.');
        },
      },
      loaded(NOW),
    );
    await store.dispatch(placeOrder());
    expect(store.getState().options.status).toBe('idle');
  });

  it('asks for new ones when the loaded tokens are about to expire', async () => {
    const { store, calls } = setup({}, loaded(NOW - OPTIONS_TTL_MS));
    await store.dispatch(placeOrder());
    expect(calls[0].acceptanceToken).toBe('acc_fresh');
  });
});
