import { catalogWithStock, VARIANT_ID } from '../../test/fakes/fixtures';
import { InMemoryTransactions } from '../../test/fakes/in-memory-transactions';
import { createTransaction, Transaction } from '../domain/transaction/transaction';
import { money } from '../domain/shared/money';
import { SettleTransaction } from './settle-transaction';

const cop = (cents: number) => {
  const m = money(cents);
  if (!m.ok) throw new Error('setup');
  return m.value;
};

const pending = (): Transaction => {
  const t = createTransaction({
    id: 't1',
    customerId: 'c1',
    variantId: VARIANT_ID,
    quantity: 2,
    amounts: { productAmount: cop(100), baseFee: cop(10), deliveryFee: cop(5), total: cop(115) },
    delivery: { recipientName: 'Ana', address: 'Calle 1', city: 'Cali', phone: '3001234567' },
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  if (!t.ok) throw new Error('setup');
  return t.value;
};

const setup = async () => {
  const catalog = catalogWithStock(VARIANT_ID, 5);
  await catalog.reserveStock(VARIANT_ID, 2);
  const transactions = new InMemoryTransactions();
  await transactions.createIfAbsent('key-0001-aaaa', pending());
  return { catalog, transactions, settle: new SettleTransaction(transactions, catalog) };
};

describe('SettleTransaction', () => {
  it('keeps the stock reserved when the payment is approved', async () => {
    const { settle, catalog, transactions } = await setup();
    const result = await settle.execute(pending(), 'APPROVED', 'prov-1');
    expect(result).toMatchObject({ status: 'APPROVED', providerRef: 'prov-1' });
    expect((await transactions.findById('t1'))?.status).toBe('APPROVED');
    expect(catalog.stockOf(VARIANT_ID)).toBe(3);
  });

  it.each(['DECLINED', 'ERROR'] as const)(
    'releases the stock when the payment is %s',
    async (s) => {
      const { settle, catalog } = await setup();
      await settle.execute(pending(), s, null);
      expect(catalog.stockOf(VARIANT_ID)).toBe(5);
    },
  );

  it('changes nothing on a second settlement, so replays are harmless', async () => {
    const { settle, catalog, transactions } = await setup();
    await settle.execute(pending(), 'DECLINED', 'prov-1');
    const again = await settle.execute(pending(), 'APPROVED', 'prov-2');
    expect(again).toMatchObject({ status: 'DECLINED', providerRef: 'prov-1' });
    expect((await transactions.findById('t1'))?.status).toBe('DECLINED');
    expect(catalog.stockOf(VARIANT_ID)).toBe(5);
  });

  it('releases the stock only once when two settlements race', async () => {
    const { settle, catalog } = await setup();
    await Promise.all([
      settle.execute(pending(), 'DECLINED', 'prov-1'),
      settle.execute(pending(), 'DECLINED', 'prov-1'),
    ]);
    expect(catalog.stockOf(VARIANT_ID)).toBe(5);
  });
});
