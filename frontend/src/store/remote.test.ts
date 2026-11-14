import { configureStore } from '@reduxjs/toolkit';
import { ApiError } from '../api/client';
import { CheckoutOptions, TransactionView } from '../api/types';
import { fakeApi } from '../test/fakeApi';
import { loadOptions, optionsReducer } from './optionsSlice';
import { clearOrder, loadOrder, orderReducer } from './orderSlice';

const options: CheckoutOptions = {
  acceptance: { token: 'a', permalink: 'https://example.test/t.pdf' },
  personalData: { token: 'p', permalink: 'https://example.test/d.pdf' },
  fees: { currency: 'COP', baseFeeInCents: 300_000, deliveryFeeInCents: 800_000 },
  maxQuantity: 10,
};
const view = (id: string, status: TransactionView['status'] = 'PENDING'): TransactionView => ({
  id,
  status,
  variantId: 'v',
  quantity: 1,
  amounts: {
    currency: 'COP',
    productAmountInCents: 1,
    baseFeeInCents: 1,
    deliveryFeeInCents: 1,
    totalInCents: 3,
  },
  createdAt: '2026-01-01T00:00:00.000Z',
});

const make = (api: Parameters<typeof fakeApi>[0]) =>
  configureStore({
    reducer: { options: optionsReducer, order: orderReducer },
    middleware: (gdm) =>
      gdm({ thunk: { extraArgument: { api: fakeApi(api), newId: () => 'x', now: () => 0 } } }),
  });

describe('options', () => {
  it('loads the terms and the fees', async () => {
    const store = make({ getCheckoutOptions: async () => options });
    expect(store.getState().options).toEqual({ status: 'idle', data: null, error: null });
    await store.dispatch(loadOptions());
    expect(store.getState().options).toEqual({ status: 'ready', data: options, error: null });
  });

  it('keeps the plain message of an error and can retry', async () => {
    let fail = true;
    const store = make({
      getCheckoutOptions: async () => {
        if (fail) throw new ApiError(503, 'GATEWAY_UNAVAILABLE', 'Try again in a minute.');
        return options;
      },
    });
    await store.dispatch(loadOptions());
    expect(store.getState().options).toMatchObject({
      status: 'failed',
      error: 'Try again in a minute.',
    });
    fail = false;
    await store.dispatch(loadOptions());
    expect(store.getState().options).toMatchObject({ status: 'ready', error: null });
  });

  it('never shows a raw error from the code', async () => {
    const store = make({
      getCheckoutOptions: async () => {
        throw new TypeError('boom');
      },
    });
    await store.dispatch(loadOptions());
    expect(store.getState().options.error).toBe('Something went wrong. Try again in a minute.');
  });
});

describe('order', () => {
  it('loads an order by id', async () => {
    const store = make({ getTransaction: async (id) => view(id, 'APPROVED') });
    await store.dispatch(loadOrder('o1'));
    expect(store.getState().order).toEqual({
      status: 'ready',
      forId: 'o1',
      view: view('o1', 'APPROVED'),
      error: null,
      errorStatus: null,
    });
  });

  it('keeps the last known order while it checks again', async () => {
    let release: (v: TransactionView) => void = () => undefined;
    const answers = [
      () => Promise.resolve(view('o1')),
      () => new Promise<TransactionView>((resolve) => (release = resolve)),
    ];
    const store = make({ getTransaction: () => answers.shift()!() });
    await store.dispatch(loadOrder('o1'));
    const again = store.dispatch(loadOrder('o1'));
    expect(store.getState().order).toMatchObject({ status: 'loading', view: view('o1') });
    release(view('o1', 'APPROVED'));
    await again;
    expect(store.getState().order.view?.status).toBe('APPROVED');
  });

  it('never shows the previous order while another one loads', async () => {
    const store = make({ getTransaction: async (id) => view(id) });
    await store.dispatch(loadOrder('o1'));
    store.dispatch({
      type: loadOrder.pending.type,
      meta: { arg: 'o2', requestId: 'r', requestStatus: 'pending' },
    });
    expect(store.getState().order).toMatchObject({ forId: 'o2', view: null, status: 'loading' });
  });

  it('says what happened when the order cannot be read, and can be cleared', async () => {
    const store = make({
      getTransaction: async () => {
        throw new ApiError(404, 'TRANSACTION_NOT_FOUND', 'We could not find that order.');
      },
    });
    await store.dispatch(loadOrder('nope'));
    expect(store.getState().order).toMatchObject({
      status: 'failed',
      error: 'We could not find that order.',
      errorStatus: 404,
      view: null,
    });
    store.dispatch(clearOrder());
    expect(store.getState().order).toEqual({
      status: 'idle',
      forId: null,
      view: null,
      error: null,
      errorStatus: null,
    });
  });
});
