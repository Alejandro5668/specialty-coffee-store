import { VARIANT_ID } from '../../../test/fakes/fixtures';
import { input, setup } from '../../../test/checkout-fixtures';
import { Clock } from '../ports/system.ports';
import { GetTransaction } from './get-transaction';

const at = (iso: string): Clock => ({ now: () => iso });

const arrange = async (now = '2026-01-01T00:01:00.000Z') => {
  const ctx = setup();
  const placed = await ctx.checkout.execute(input());
  if (!placed.ok) throw new Error('setup');
  const getTransaction = new GetTransaction(ctx.transactions, ctx.gateway, ctx.catalog, at(now));
  return { ...ctx, getTransaction, id: placed.value.id };
};

describe('GetTransaction', () => {
  it('returns the stored transaction', async () => {
    const { getTransaction, id } = await arrange();
    expect(await getTransaction.execute(id)).toMatchObject({
      ok: true,
      value: { id, status: 'PENDING' },
    });
  });

  it.each(['nope', '', '../etc/passwd', "1' OR '1'='1", 'x'.repeat(10_000), 42])(
    'answers not found for %p',
    async (id) => {
      const { getTransaction } = await arrange();
      expect(await getTransaction.execute(id as string)).toEqual({
        ok: false,
        error: 'TRANSACTION_NOT_FOUND',
      });
    },
  );

  it('does not ask the provider about a final transaction', async () => {
    const { getTransaction, id, gateway, transactions } = await arrange();
    gateway.known.set(id, { providerRef: 'p', status: 'APPROVED' });
    await getTransaction.execute(id);
    await getTransaction.execute(id);
    expect(gateway.lookups).toBe(1);
    expect((await transactions.findById(id))?.status).toBe('APPROVED');
  });

  it('settles APPROVED from the provider and keeps the stock sold', async () => {
    const { getTransaction, id, gateway, catalog } = await arrange();
    gateway.known.set(id, { providerRef: 'prov-7', status: 'APPROVED' });
    expect(await getTransaction.execute(id)).toMatchObject({
      ok: true,
      value: { status: 'APPROVED', providerRef: 'prov-7' },
    });
    expect(catalog.stockOf(VARIANT_ID)).toBe(3);
  });

  it('settles DECLINED from the provider and releases the stock', async () => {
    const { getTransaction, id, gateway, catalog } = await arrange();
    gateway.known.set(id, { providerRef: 'prov-7', status: 'DECLINED' });
    expect(await getTransaction.execute(id)).toMatchObject({
      ok: true,
      value: { status: 'DECLINED' },
    });
    expect(catalog.stockOf(VARIANT_ID)).toBe(5);
  });

  it('stays PENDING while the provider is still processing', async () => {
    const { getTransaction, id, gateway } = await arrange();
    gateway.known.set(id, { providerRef: 'prov-7', status: 'PENDING' });
    expect(await getTransaction.execute(id)).toMatchObject({
      ok: true,
      value: { status: 'PENDING' },
    });
  });

  it('stays PENDING when the provider cannot be reached', async () => {
    const { getTransaction, id, gateway, catalog } = await arrange('2026-01-01T01:00:00.000Z');
    gateway.lookupFails = true;
    expect(await getTransaction.execute(id)).toMatchObject({
      ok: true,
      value: { status: 'PENDING' },
    });
    expect(catalog.stockOf(VARIANT_ID)).toBe(3);
  });

  it('waits before concluding that a recent unknown transaction failed', async () => {
    const { getTransaction, id, catalog } = await arrange('2026-01-01T00:04:59.000Z');
    expect(await getTransaction.execute(id)).toMatchObject({
      ok: true,
      value: { status: 'PENDING' },
    });
    expect(catalog.stockOf(VARIANT_ID)).toBe(3);
  });

  it('settles ERROR and releases the stock when the provider never saw an old transaction', async () => {
    const { getTransaction, id, catalog } = await arrange('2026-01-01T00:05:01.000Z');
    expect(await getTransaction.execute(id)).toMatchObject({
      ok: true,
      value: { status: 'ERROR', providerRef: null },
    });
    expect(catalog.stockOf(VARIANT_ID)).toBe(5);
  });
});
