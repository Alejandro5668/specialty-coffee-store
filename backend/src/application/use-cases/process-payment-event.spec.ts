import { VARIANT_ID } from '../../../test/fakes/fixtures';
import { FakeVerifier } from '../../../test/fakes/fake-verifier';
import { input, setup } from '../../../test/checkout-fixtures';
import { ProcessPaymentEvent } from './process-payment-event';

const arrange = async () => {
  const ctx = setup();
  const placed = await ctx.checkout.execute(input());
  if (!placed.ok) throw new Error('setup');
  const processor = new ProcessPaymentEvent(new FakeVerifier(), ctx.transactions, ctx.orders);
  const event = (over: Record<string, unknown> = {}) => ({
    signature: 'valid',
    reference: placed.value.id,
    providerRef: 'prov-1',
    status: 'APPROVED',
    amountInCents: 7_500_000,
    ...over,
  });
  return { ...ctx, processor, tx: placed.value, event };
};

describe('ProcessPaymentEvent', () => {
  it('settles APPROVED and keeps the stock sold', async () => {
    const { processor, event, catalog, transactions, tx } = await arrange();
    const result = await processor.execute(event());
    expect(result).toMatchObject({
      ok: true,
      value: { status: 'APPROVED', providerRef: 'prov-1' },
    });
    expect((await transactions.findById(tx.id))?.status).toBe('APPROVED');
    expect(catalog.stockOf(VARIANT_ID)).toBe(3);
  });

  it.each(['DECLINED', 'ERROR'])('settles %s and releases the stock', async (status) => {
    const { processor, event, catalog } = await arrange();
    const result = await processor.execute(event({ status }));
    expect(result).toMatchObject({ ok: true, value: { status } });
    expect(catalog.stockOf(VARIANT_ID)).toBe(5);
  });

  it('rejects a forged signature and changes nothing', async () => {
    const { processor, event, catalog, transactions, tx } = await arrange();
    const result = await processor.execute(event({ signature: 'forged' }));
    expect(result).toEqual({ ok: false, error: 'INVALID_SIGNATURE' });
    expect((await transactions.findById(tx.id))?.status).toBe('PENDING');
    expect(catalog.stockOf(VARIANT_ID)).toBe(3);
  });

  it.each([null, 'text', 42])('rejects a malformed payload %p', async (payload) => {
    const { processor } = await arrange();
    expect(await processor.execute(payload)).toEqual({ ok: false, error: 'MALFORMED_EVENT' });
  });

  it('is idempotent: a replayed event changes nothing and releases the stock once', async () => {
    const { processor, event, catalog } = await arrange();
    const first = await processor.execute(event({ status: 'DECLINED' }));
    const replay = await processor.execute(event({ status: 'DECLINED' }));
    expect(replay).toEqual(first);
    expect(catalog.stockOf(VARIANT_ID)).toBe(5);
  });

  it('releases the stock once when the same event arrives in parallel', async () => {
    const { processor, event, catalog } = await arrange();
    await Promise.all([
      processor.execute(event({ status: 'DECLINED' })),
      processor.execute(event({ status: 'DECLINED' })),
    ]);
    expect(catalog.stockOf(VARIANT_ID)).toBe(5);
  });

  it('ignores a later conflicting event once the transaction is final', async () => {
    const { processor, event, catalog } = await arrange();
    await processor.execute(event({ status: 'APPROVED' }));
    const late = await processor.execute(event({ status: 'DECLINED' }));
    expect(late).toMatchObject({ ok: true, value: { status: 'APPROVED' } });
    expect(catalog.stockOf(VARIANT_ID)).toBe(3);
  });

  it('rejects an event for an unknown transaction', async () => {
    const { processor, event } = await arrange();
    const result = await processor.execute(event({ reference: 'nope' }));
    expect(result).toEqual({ ok: false, error: 'UNKNOWN_TRANSACTION' });
  });

  it('rejects an event whose amount differs from ours and changes nothing', async () => {
    const { processor, event, transactions, tx } = await arrange();
    const result = await processor.execute(event({ amountInCents: 100 }));
    expect(result).toEqual({ ok: false, error: 'AMOUNT_MISMATCH' });
    expect((await transactions.findById(tx.id))?.status).toBe('PENDING');
  });

  it('leaves the transaction untouched on a PENDING event', async () => {
    const { processor, event, catalog } = await arrange();
    const result = await processor.execute(event({ status: 'PENDING' }));
    expect(result).toMatchObject({ ok: true, value: { status: 'PENDING' } });
    expect(catalog.stockOf(VARIANT_ID)).toBe(3);
  });
});
