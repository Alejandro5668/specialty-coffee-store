import { CheckoutState, initialCheckout } from '../store/checkoutState';

export const NOW = 1_700_000_000_000;

/** A shopper who has chosen a coffee, filled the form, accepted the terms and tokenized a card. */
export const draft = (over: Partial<CheckoutState> = {}): CheckoutState => ({
  ...initialCheckout,
  variantId: 'huila-washed-250',
  quantity: 2,
  customer: { name: 'Ana Pérez', email: 'ana@example.com' },
  delivery: {
    recipientName: 'Ana Pérez',
    address: 'Calle 10 # 5-20',
    city: 'Medellín',
    phone: '300 123 4567',
  },
  accepted: { terms: true, personalData: true },
  card: { token: 'tok_test_123456', brand: 'visa', last4: '4242', at: NOW },
  ...over,
});
