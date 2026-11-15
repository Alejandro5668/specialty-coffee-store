import { configureStore } from '@reduxjs/toolkit';
import { CheckoutOptions } from '../api/types';
import { fakeApi } from '../test/fakeApi';
import {
  isOptionsFresh,
  loadOptions,
  OPTIONS_TTL_MS,
  optionsReducer,
  optionsUsed,
} from './optionsSlice';

const options: CheckoutOptions = {
  acceptance: { token: 'a', permalink: 'https://example.test/t.pdf' },
  personalData: { token: 'p', permalink: 'https://example.test/d.pdf' },
  fees: { currency: 'COP', baseFeeInCents: 300_000, deliveryFeeInCents: 800_000 },
  maxQuantity: 10,
};

const make = (api: Parameters<typeof fakeApi>[0]) =>
  configureStore({
    reducer: { options: optionsReducer },
    middleware: (gdm) =>
      gdm({ thunk: { extraArgument: { api: fakeApi(api), newId: () => 'x', now: () => 0 } } }),
  });

describe('options: single-use tokens', () => {
  it('marks the tokens as used, so they can never be sent twice, and keeps the fees on screen', async () => {
    const store = make({ getCheckoutOptions: async () => options });
    await store.dispatch(loadOptions());
    store.dispatch(optionsUsed());
    expect(store.getState().options).toEqual({
      status: 'ready',
      data: options,
      error: null,
      loadedAt: null,
    });
    expect(isOptionsFresh(store.getState().options, 0)).toBe(false);
  });

  it('keeps showing the loaded fees while the tokens are refreshed', async () => {
    const store = make({ getCheckoutOptions: async () => options });
    await store.dispatch(loadOptions());
    const refresh = store.dispatch(loadOptions());
    expect(store.getState().options).toMatchObject({ status: 'loading', data: options });
    await refresh;
  });

  it.each([
    ['just loaded', 0, true],
    ['almost expired', OPTIONS_TTL_MS - 1, true],
    ['expired', OPTIONS_TTL_MS, false],
  ])('treats tokens %s as usable: %s', (_label, age, usable) => {
    const state = { status: 'ready' as const, data: options, error: null, loadedAt: 1000 };
    expect(isOptionsFresh(state, 1000 + age)).toBe(usable);
  });

  it('never treats a missing, failed or loading result as usable', () => {
    const base = { data: options, error: null, loadedAt: 1000 };
    expect(isOptionsFresh({ ...base, status: 'loading' }, 1000)).toBe(false);
    expect(isOptionsFresh({ ...base, status: 'failed' }, 1000)).toBe(false);
    expect(isOptionsFresh({ ...base, status: 'ready', data: null }, 1000)).toBe(false);
    expect(isOptionsFresh({ ...base, status: 'ready', loadedAt: null }, 1000)).toBe(false);
  });
});
