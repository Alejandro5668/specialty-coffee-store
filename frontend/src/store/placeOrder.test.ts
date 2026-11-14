import { configureStore } from '@reduxjs/toolkit';
import { ApiError, CoffeeApi } from '../api/client';
import { CheckoutOptions, OrderRequest, TransactionView } from '../api/types';
import { draft, NOW } from '../test/state';
import { fakeApi } from '../test/fakeApi';
import { checkoutReducer } from './checkoutSlice';
import { CARD_TTL_MS, CheckoutState } from './checkoutState';
import { placeOrder } from './placeOrder';

const options: CheckoutOptions = {
  acceptance: { token: 'acc_fresh', permalink: 'https://example.test/t.pdf' },
  personalData: { token: 'per_fresh', permalink: 'https://example.test/d.pdf' },
  fees: { currency: 'COP', baseFeeInCents: 300_000, deliveryFeeInCents: 800_000 },
  maxQuantity: 10,
};
const placed: TransactionView = {
  id: 'order-1',
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
};

const setup = (state: CheckoutState, api: Partial<CoffeeApi> = {}, now = NOW) => {
  const calls: OrderRequest[] = [];
  const keys: Array<string | null> = [];
  const store = configureStore({
    reducer: { checkout: checkoutReducer },
    preloadedState: { checkout: state },
    middleware: (gdm) =>
      gdm({
        thunk: {
          extraArgument: {
            now: () => now,
            newId: () => 'key-new-0001',
            api: fakeApi({
              getCheckoutOptions: async () => options,
              createOrder: async (request) => {
                calls.push(request);
                keys.push(store.getState().checkout.idempotencyKey);
                return placed;
              },
              ...api,
            }),
          },
        },
      }),
  });
  return { store, calls, keys };
};

describe('placeOrder', () => {
  it('sends the order with fresh acceptance tokens and the stored card token', async () => {
    const { store, calls } = setup(draft());
    await store.dispatch(placeOrder());
    expect(calls).toEqual([
      {
        idempotencyKey: 'key-new-0001',
        variantId: 'huila-washed-250',
        quantity: 2,
        customer: { name: 'Ana Pérez', email: 'ana@example.com' },
        delivery: {
          recipientName: 'Ana Pérez',
          address: 'Calle 10 # 5-20',
          city: 'Medellín',
          phone: '3001234567',
        },
        cardToken: 'tok_test_123456',
        acceptanceToken: 'acc_fresh',
        personalAuthToken: 'per_fresh',
      },
    ]);
  });

  it('never sends a price or an amount: the server computes them', async () => {
    const { store, calls } = setup(draft());
    await store.dispatch(placeOrder());
    expect(JSON.stringify(calls[0])).not.toMatch(/amount|price|total|fee/i);
  });

  it('saves the key before the request leaves, so a refresh in the middle can retry safely', async () => {
    const { store, keys } = setup(draft());
    await store.dispatch(placeOrder());
    expect(keys).toEqual(['key-new-0001']);
  });

  it('reuses the key of an earlier attempt instead of making a new one', async () => {
    const { store, calls } = setup(draft({ idempotencyKey: 'key-old-0001' }));
    await store.dispatch(placeOrder());
    expect(calls[0].idempotencyKey).toBe('key-old-0001');
  });

  it('remembers the order, and the card token is spent', async () => {
    const { store } = setup(draft());
    await store.dispatch(placeOrder());
    expect(store.getState().checkout).toMatchObject({
      orderId: 'order-1',
      placing: 'idle',
      placeError: null,
      card: null,
    });
  });

  it('never calls the API twice for the same click, even when it is pressed twice', async () => {
    let release: (v: TransactionView) => void = () => undefined;
    const createOrder = jest.fn(
      () => new Promise<TransactionView>((resolve) => (release = resolve)),
    );
    const { store } = setup(draft(), { createOrder });
    const first = store.dispatch(placeOrder());
    const second = store.dispatch(placeOrder());
    expect(store.getState().checkout.placing).toBe('placing');
    while (createOrder.mock.calls.length === 0) await new Promise((r) => setTimeout(r, 0));
    release(placed);
    await Promise.all([first, second]);
    await new Promise((r) => setTimeout(r, 0));
    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(store.getState().checkout.placing).toBe('idle');
  });

  it.each([
    ['no coffee chosen', draft({ variantId: null })],
    ['no card', draft({ card: null })],
    [
      'a card token older than 30 minutes',
      draft({
        card: { token: 'tok_test_123456', brand: 'visa', last4: '4242', at: NOW - CARD_TTL_MS - 1 },
      }),
    ],
    [
      'a card token from the future',
      draft({ card: { token: 'tok_test_123456', brand: 'visa', last4: '4242', at: NOW + 60_000 } }),
    ],
    ['the terms not accepted', draft({ accepted: { terms: false, personalData: true } })],
    [
      'the data authorization not accepted',
      draft({ accepted: { terms: true, personalData: false } }),
    ],
  ])('does not even try with %s', async (_label, state) => {
    const getCheckoutOptions = jest.fn(async () => options);
    const { store, calls } = setup(state, { getCheckoutOptions });
    await store.dispatch(placeOrder());
    expect(getCheckoutOptions).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
    expect(store.getState().checkout).toMatchObject({
      placing: 'failed',
      placeError: 'Revisa tus datos e inténtalo de nuevo.',
    });
  });

  it('keeps the plain message of an API error and the key for a safe retry', async () => {
    const { store } = setup(draft(), {
      createOrder: async () => {
        throw new ApiError(
          409,
          'OUT_OF_STOCK',
          'There is not enough stock for that quantity. Choose fewer units.',
        );
      },
    });
    await store.dispatch(placeOrder());
    expect(store.getState().checkout).toMatchObject({
      placing: 'failed',
      placeError: 'There is not enough stock for that quantity. Choose fewer units.',
      idempotencyKey: 'key-new-0001',
      orderId: null,
    });
  });

  it('does not send the order when the terms cannot be fetched', async () => {
    const { store, calls } = setup(draft(), {
      getCheckoutOptions: async () => {
        throw new ApiError(
          503,
          'GATEWAY_UNAVAILABLE',
          'We cannot reach the payment service right now.',
        );
      },
    });
    await store.dispatch(placeOrder());
    expect(calls).toHaveLength(0);
    expect(store.getState().checkout.placeError).toBe(
      'We cannot reach the payment service right now.',
    );
  });

  it('never shows a raw error from the code', async () => {
    const { store } = setup(draft(), {
      createOrder: async () => {
        throw new TypeError("Cannot read properties of undefined (reading 'x')");
      },
    });
    await store.dispatch(placeOrder());
    expect(store.getState().checkout.placeError).toBe(
      'Algo salió mal. Inténtalo de nuevo en un minuto.',
    );
  });
});
