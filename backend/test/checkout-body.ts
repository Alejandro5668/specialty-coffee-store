export const body = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  idempotencyKey: 'key-0001-aaaa',
  variantId: 'huila-washed-250',
  quantity: 2,
  customer: { name: 'Ana Pérez', email: 'ana@example.com' },
  delivery: {
    recipientName: 'Ana Pérez',
    address: 'Calle 10 # 5-20',
    city: 'Medellín',
    phone: '3001234567',
  },
  cardToken: 'tok_test_123',
  acceptanceToken: 'acc_123',
  personalAuthToken: 'per_123',
  ...over,
});
