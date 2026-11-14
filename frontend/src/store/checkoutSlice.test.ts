import { draft } from '../test/state';
import {
  cardCleared,
  cardTokenized,
  checkoutReducer,
  clearCheckout,
  orderFinished,
  retryPayment,
  selectCoffee,
  setAccepted,
  updateCustomer,
  updateDelivery,
} from './checkoutSlice';
import { initialCheckout } from './checkoutState';
import { keyAssigned } from './placeOrder';

const withKey = draft({ idempotencyKey: 'key-0001-aaaa', orderId: null });

describe('checkout draft', () => {
  it('starts with nothing chosen and nothing typed', () => {
    expect(checkoutReducer(undefined, { type: 'x' })).toEqual({
      variantId: null,
      quantity: 1,
      customer: { name: '', email: '' },
      delivery: { recipientName: '', address: '', city: '', phone: '' },
      accepted: { terms: false, personalData: false },
      card: null,
      idempotencyKey: null,
      orderId: null,
      placing: 'idle',
      placeError: null,
    });
  });

  it('remembers the coffee and quantity, and starts a new attempt', () => {
    const next = checkoutReducer(
      draft({ idempotencyKey: 'key-0001-aaaa', orderId: 'old' }),
      selectCoffee({ variantId: 'a-500', quantity: 3 }),
    );
    expect(next).toMatchObject({
      variantId: 'a-500',
      quantity: 3,
      idempotencyKey: null,
      orderId: null,
    });
    expect(next.customer.name).toBe('Ana Pérez');
  });

  it.each([
    ['the customer', updateCustomer({ name: 'Luis' })],
    ['the delivery', updateDelivery({ city: 'Cali' })],
    [
      'the card',
      cardTokenized({ token: 'tok_other_1234', brand: 'mastercard', last4: '4444', at: 1 }),
    ],
    ['the choice of coffee', selectCoffee({ variantId: 'b-250', quantity: 1 })],
  ])(
    'forgets the idempotency key when %s changes, so a changed order is never mistaken for the old one',
    (_l, action) => {
      expect(checkoutReducer(withKey, action).idempotencyKey).toBeNull();
    },
  );

  it('keeps the key when only the accepted terms change', () => {
    expect(checkoutReducer(withKey, setAccepted({ terms: false })).idempotencyKey).toBe(
      'key-0001-aaaa',
    );
  });

  it('merges partial updates of the customer, the delivery and the terms', () => {
    let state = checkoutReducer(initialCheckout, updateCustomer({ name: 'Ana' }));
    state = checkoutReducer(state, updateCustomer({ email: 'ana@example.com' }));
    state = checkoutReducer(state, updateDelivery({ address: 'Calle 1' }));
    state = checkoutReducer(state, setAccepted({ terms: true }));
    expect(state.customer).toEqual({ name: 'Ana', email: 'ana@example.com' });
    expect(state.delivery.address).toBe('Calle 1');
    expect(state.accepted).toEqual({ terms: true, personalData: false });
  });

  it('keeps only the token, the brand and the last four digits of a card', () => {
    const state = checkoutReducer(
      initialCheckout,
      cardTokenized({ token: 'tok_test_123456', brand: 'visa', last4: '4242', at: 5 }),
    );
    expect(state.card).toEqual({ token: 'tok_test_123456', brand: 'visa', last4: '4242', at: 5 });
    expect(checkoutReducer(state, cardCleared()).card).toBeNull();
  });

  it('assigns the key once and keeps it for retries', () => {
    expect(checkoutReducer(initialCheckout, keyAssigned('key-0002-bbbb')).idempotencyKey).toBe(
      'key-0002-bbbb',
    );
  });

  it('lets the shopper pay again with another card after a failed payment', () => {
    const failed = draft({
      idempotencyKey: 'key-0001-aaaa',
      orderId: 'o1',
      placeError: 'x',
      placing: 'failed',
    });
    expect(checkoutReducer(failed, retryPayment())).toMatchObject({
      card: null,
      idempotencyKey: null,
      orderId: null,
      placeError: null,
      placing: 'idle',
      variantId: 'huila-washed-250',
      customer: { name: 'Ana Pérez', email: 'ana@example.com' },
    });
  });

  it('forgets the whole purchase when it is finished, but not before', () => {
    expect(checkoutReducer(draft({ orderId: 'o1' }), orderFinished())).toEqual(initialCheckout);
    expect(checkoutReducer(draft(), clearCheckout())).toEqual(initialCheckout);
  });
});
