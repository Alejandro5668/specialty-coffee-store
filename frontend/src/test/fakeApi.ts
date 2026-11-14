import { CoffeeApi } from '../api/client';

/** A full API where everything fails loudly unless the test provides it. */
export const fakeApi = (overrides: Partial<CoffeeApi> = {}): CoffeeApi => ({
  listProducts: async () => {
    throw new Error('listProducts was not expected');
  },
  getCheckoutOptions: async () => {
    throw new Error('getCheckoutOptions was not expected');
  },
  createOrder: async () => {
    throw new Error('createOrder was not expected');
  },
  getTransaction: async () => {
    throw new Error('getTransaction was not expected');
  },
  ...overrides,
});
