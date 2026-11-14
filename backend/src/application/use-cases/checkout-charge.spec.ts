import { err, ok } from '../../domain/shared/result';
import { VARIANT_ID } from '../../../test/fakes/fixtures';
import { input, setup } from '../../../test/checkout-fixtures';

describe('Checkout charging', () => {
  it('charges the backend total with our transaction id as reference', async () => {
    const { checkout, gateway } = setup();
    const result = await checkout.execute(input());
    if (!result.ok) throw new Error('expected ok');
    expect(gateway.charges).toEqual([
      {
        reference: result.value.id,
        amountInCents: 7_500_000,
        customerEmail: 'ana@example.com',
        cardToken: 'tok_test_123',
        acceptanceToken: 'acc_123',
        personalAuthToken: 'per_123',
      },
    ]);
  });

  it('leaves the transaction PENDING and the stock reserved while the provider processes it', async () => {
    const { checkout, catalog } = setup();
    const result = await checkout.execute(input());
    expect(result).toMatchObject({ ok: true, value: { status: 'PENDING' } });
    expect(catalog.stockOf(VARIANT_ID)).toBe(3);
  });

  it('charges once on a repeated or parallel submit', async () => {
    const { checkout, gateway } = setup();
    await Promise.all([checkout.execute(input()), checkout.execute(input())]);
    await checkout.execute(input());
    expect(gateway.charges).toHaveLength(1);
  });

  it('settles APPROVED when the provider answers immediately and keeps the stock sold', async () => {
    const { checkout, catalog, transactions, gateway } = setup();
    gateway.next = ok({ providerRef: 'prov-9', status: 'APPROVED' });
    const result = await checkout.execute(input());
    expect(result).toMatchObject({
      ok: true,
      value: { status: 'APPROVED', providerRef: 'prov-9' },
    });
    expect(transactions.all()[0].status).toBe('APPROVED');
    expect(catalog.stockOf(VARIANT_ID)).toBe(3);
  });

  it('settles DECLINED and releases the stock', async () => {
    const { checkout, catalog, transactions, gateway } = setup();
    gateway.next = ok({ providerRef: 'prov-9', status: 'DECLINED' });
    const result = await checkout.execute(input());
    expect(result).toMatchObject({ ok: true, value: { status: 'DECLINED' } });
    expect(transactions.all()[0].status).toBe('DECLINED');
    expect(catalog.stockOf(VARIANT_ID)).toBe(5);
  });

  it('settles ERROR and releases the stock when the provider rejects the request', async () => {
    const { checkout, catalog, transactions, gateway } = setup();
    gateway.next = err('GATEWAY_REJECTED');
    const result = await checkout.execute(input());
    expect(result).toMatchObject({ ok: true, value: { status: 'ERROR', providerRef: null } });
    expect(transactions.all()[0].status).toBe('ERROR');
    expect(catalog.stockOf(VARIANT_ID)).toBe(5);
  });

  it('keeps PENDING and the stock reserved on a timeout or 5xx, and never charges twice on retry', async () => {
    const { checkout, catalog, transactions, gateway } = setup();
    gateway.next = err('GATEWAY_UNAVAILABLE');
    const first = await checkout.execute(input());
    const retry = await checkout.execute(input());
    expect(first).toMatchObject({ ok: true, value: { status: 'PENDING' } });
    expect(retry).toMatchObject({ ok: true, value: { status: 'PENDING' } });
    expect(transactions.all()).toHaveLength(1);
    expect(gateway.charges).toHaveLength(1);
    expect(catalog.stockOf(VARIANT_ID)).toBe(3);
  });

  it('keeps PENDING and the stock reserved when the gateway throws, and never charges twice on retry', async () => {
    const { checkout, catalog, transactions, gateway } = setup();
    gateway.charge = async (request) => {
      gateway.charges.push(request);
      throw new Error('socket hang up');
    };
    const first = await checkout.execute(input());
    const retry = await checkout.execute(input());
    expect(first).toMatchObject({ ok: true, value: { status: 'PENDING' } });
    expect(retry).toMatchObject({ ok: true, value: { status: 'PENDING' } });
    expect(transactions.all()).toHaveLength(1);
    expect(gateway.charges).toHaveLength(1);
    expect(catalog.stockOf(VARIANT_ID)).toBe(3);
  });
});
