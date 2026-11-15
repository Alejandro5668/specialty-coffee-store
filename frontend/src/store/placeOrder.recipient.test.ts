import { configureStore } from '@reduxjs/toolkit';
import { OrderRequest, TransactionView } from '../api/types';
import { fakeApi } from '../test/fakeApi';
import { draft, NOW } from '../test/state';
import { checkoutReducer } from './checkoutSlice';
import { optionsReducer } from './optionsSlice';
import { placeOrder } from './placeOrder';

const sent = async (recipientName: string): Promise<OrderRequest> => {
  const requests: OrderRequest[] = [];
  const base = draft();
  const store = configureStore({
    reducer: { checkout: checkoutReducer, options: optionsReducer },
    preloadedState: {
      checkout: { ...base, delivery: { ...base.delivery, recipientName } },
      options: { status: 'idle' as const, data: null, error: null, loadedAt: null },
    },
    middleware: (gdm) =>
      gdm({
        thunk: {
          extraArgument: {
            now: () => NOW,
            newId: () => 'key-new-0001',
            api: fakeApi({
              getCheckoutOptions: async () => ({
                acceptance: { token: 'acc', permalink: 'https://example.test/t.pdf' },
                personalData: { token: 'per', permalink: 'https://example.test/d.pdf' },
                fees: { currency: 'COP', baseFeeInCents: 300_000, deliveryFeeInCents: 800_000 },
                maxQuantity: 10,
              }),
              createOrder: async (request) => {
                requests.push(request);
                return { id: 'order-1', status: 'PENDING' } as TransactionView;
              },
            }),
          },
        },
      }),
  });
  await store.dispatch(placeOrder());
  return requests[0];
};

describe('placeOrder: the recipient is optional', () => {
  it('sends the buyer as the recipient when no other recipient was typed', async () => {
    expect((await sent('')).delivery.recipientName).toBe('Ana Pérez');
    expect((await sent('   ')).delivery.recipientName).toBe('Ana Pérez');
  });

  it('sends the typed recipient, without surrounding spaces, when there is one', async () => {
    expect((await sent('  Luis Gómez ')).delivery.recipientName).toBe('Luis Gómez');
  });
});
