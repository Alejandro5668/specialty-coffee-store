import { VARIANT_ID } from '../../../test/fakes/fixtures';
import { input, setup } from '../../../test/checkout-fixtures';
import { FakeGateway } from '../../../test/fakes/fake-gateway';
import { fixedClock, sequentialIds } from '../../../test/fakes/fixtures';
import { InMemoryOrders } from '../../../test/fakes/in-memory-orders';
import { Checkout, CheckoutInput } from './checkout';

describe('Checkout', () => {
  it('creates a PENDING transaction with amounts computed by the backend', async () => {
    const { checkout, catalog } = setup();
    const result = await checkout.execute(input());
    if (!result.ok) throw new Error(`expected ok, got ${result.error}`);

    expect(result.value).toMatchObject({ status: 'PENDING', quantity: 2, variantId: VARIANT_ID });
    expect(result.value.amounts.productAmount.amountInCents).toBe(6_400_000);
    expect(result.value.amounts.baseFee.amountInCents).toBe(300_000);
    expect(result.value.amounts.deliveryFee.amountInCents).toBe(800_000);
    expect(result.value.amounts.total.amountInCents).toBe(7_500_000);
    expect(result.value.delivery.city).toBe('Medellín');
    expect(catalog.stockOf(VARIANT_ID)).toBe(3);
  });

  it('ignores amounts sent by the client', async () => {
    const { checkout } = setup();
    const forged = { ...input(), amountInCents: 1, total: 1, price: 1 } as CheckoutInput;
    const result = await checkout.execute(forged);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.amounts.total.amountInCents).toBe(7_500_000);
  });

  it('reuses the customer with the same email', async () => {
    const { checkout, transactions } = setup();
    await checkout.execute(input());
    await checkout.execute(input({ idempotencyKey: 'key-0002-bbbb' }));
    const [a, b] = transactions.all();
    expect(a.customerId).toBe(b.customerId);
  });

  it('rejects an unknown variant', async () => {
    const { checkout, transactions } = setup();
    const result = await checkout.execute(input({ variantId: 'nope' }));
    expect(result).toEqual({ ok: false, error: 'VARIANT_NOT_FOUND' });
    expect(transactions.all()).toHaveLength(0);
  });

  it('rejects more units than the stock and leaves everything untouched', async () => {
    const { checkout, catalog, transactions } = setup(1);
    const result = await checkout.execute(input({ quantity: 2 }));
    expect(result).toEqual({ ok: false, error: 'OUT_OF_STOCK' });
    expect(catalog.stockOf(VARIANT_ID)).toBe(1);
    expect(transactions.all()).toHaveLength(0);
  });

  it('lets exactly one of two parallel buyers take the last unit', async () => {
    const { checkout, catalog, transactions } = setup(1);
    const results = await Promise.all([
      checkout.execute(input({ idempotencyKey: 'key-0001-aaaa', quantity: 1 })),
      checkout.execute(input({ idempotencyKey: 'key-0002-bbbb', quantity: 1 })),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, error: 'OUT_OF_STOCK' }]);
    expect(catalog.stockOf(VARIANT_ID)).toBe(0);
    expect(transactions.all()).toHaveLength(1);
  });

  it('returns the same transaction on a repeated submit with the same key', async () => {
    const { checkout, catalog, transactions } = setup();
    const first = await checkout.execute(input());
    const second = await checkout.execute(input());
    if (!first.ok || !second.ok) throw new Error('expected ok');
    expect(second.value.id).toBe(first.value.id);
    expect(transactions.all()).toHaveLength(1);
    expect(catalog.stockOf(VARIANT_ID)).toBe(3);
  });

  it('creates one transaction and reserves once on a parallel double submit', async () => {
    const { checkout, catalog, transactions } = setup();
    const [a, b] = await Promise.all([checkout.execute(input()), checkout.execute(input())]);
    if (!a.ok || !b.ok) throw new Error('expected ok');
    expect(a.value.id).toBe(b.value.id);
    expect(transactions.all()).toHaveLength(1);
    expect(catalog.stockOf(VARIANT_ID)).toBe(3);
  });

  it('answers a parallel double submit with the stored order even when the stock covers only one', async () => {
    const { checkout, catalog, transactions, gateway } = setup(2);
    const [a, b] = await Promise.all([checkout.execute(input()), checkout.execute(input())]);
    if (!a.ok || !b.ok) throw new Error('expected both calls to answer with the order');
    expect(a.value.id).toBe(b.value.id);
    expect(transactions.all()).toHaveLength(1);
    expect(gateway.charges).toHaveLength(1);
    expect(catalog.stockOf(VARIANT_ID)).toBe(0);
  });

  it.each([
    ['zero quantity', { quantity: 0 }],
    ['negative quantity', { quantity: -3 }],
    ['fractional quantity', { quantity: 1.5 }],
    ['above the order limit', { quantity: 11 }],
    ['huge quantity', { quantity: 1_000_000_000 }],
    ['non-numeric quantity', { quantity: '2' as unknown as number }],
    ['script in the address', { delivery: { ...input().delivery, address: '<script>x</script>' } }],
    ['bad email', { customer: { name: 'Ana', email: 'not-an-email' } }],
    ['bad phone', { delivery: { ...input().delivery, phone: 'abc' } }],
    ['short idempotency key', { idempotencyKey: 'x' }],
    ['idempotency key with spaces', { idempotencyKey: 'key with spaces 123' }],
    ['missing card token', { cardToken: '' }],
    ['non-string card token', { cardToken: 123 as unknown as string }],
    ['missing acceptance token', { acceptanceToken: '  ' }],
    ['missing personal data token', { personalAuthToken: '' }],
  ])('rejects %s without side effects', async (_label, over) => {
    const { checkout, catalog, transactions } = setup();
    const result = await checkout.execute(input(over as Partial<CheckoutInput>));
    expect(result).toEqual({ ok: false, error: 'INVALID_INPUT' });
    expect(catalog.stockOf(VARIANT_ID)).toBe(5);
    expect(transactions.all()).toHaveLength(0);
  });

  it('does not charge when the input is invalid or the stock is short', async () => {
    const { checkout, gateway } = setup(1);
    await checkout.execute(input({ quantity: 2 }));
    await checkout.execute(input({ cardToken: '' }));
    expect(gateway.charges).toHaveLength(0);
  });

  it('leaves the stock and the orders untouched when saving the customer fails', async () => {
    const { catalog, transactions, customers } = setup();
    customers.save = async () => {
      throw new Error('db down');
    };
    const checkout = new Checkout(
      catalog,
      transactions,
      new InMemoryOrders(catalog, transactions),
      customers,
      new FakeGateway(),
      sequentialIds(),
      fixedClock,
    );
    await expect(checkout.execute(input())).rejects.toThrow('db down');
    expect(catalog.stockOf(VARIANT_ID)).toBe(5);
    expect(transactions.all()).toHaveLength(0);
  });
});
