import { FakeGateway } from './fakes/fake-gateway';
import { InMemoryCatalog } from './fakes/in-memory-catalog';
import { InMemoryCustomers } from './fakes/in-memory-customers';
import { InMemoryTransactions } from './fakes/in-memory-transactions';
import { catalogWithStock, fixedClock, sequentialIds, VARIANT_ID } from './fakes/fixtures';
import { Checkout, CheckoutInput } from '../src/application/use-cases/checkout';

export const input = (over: Partial<CheckoutInput> = {}): CheckoutInput => ({
  idempotencyKey: 'key-0001-aaaa',
  variantId: VARIANT_ID,
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

export const setup = (stock = 5) => {
  const catalog: InMemoryCatalog = catalogWithStock(VARIANT_ID, stock);
  const transactions = new InMemoryTransactions();
  const customers = new InMemoryCustomers();
  const gateway = new FakeGateway();
  const checkout = new Checkout(
    catalog,
    transactions,
    customers,
    gateway,
    sequentialIds(),
    fixedClock,
  );
  return { catalog, transactions, customers, gateway, checkout };
};
