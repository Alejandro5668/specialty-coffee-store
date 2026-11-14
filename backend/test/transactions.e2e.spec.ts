import request from 'supertest';
import { err } from '../src/domain/shared/result';
import { buildTestApp } from './app-factory';
import { body } from './checkout-body';
import { VARIANT_ID } from './fakes/fixtures';

type Built = Awaited<ReturnType<typeof buildTestApp>>;
let built: Built;
beforeEach(async () => {
  built = await buildTestApp(5);
});
afterEach(async () => built.app.close());

const get = (id: string) => request(built.app.getHttpServer()).get(`/transactions/${id}`);
const placeOrder = async (): Promise<string> => {
  const res = await request(built.app.getHttpServer()).post('/checkout').send(body());
  return res.body.id as string;
};

describe('GET /transactions/:id', () => {
  it('returns the order the shopper placed', async () => {
    const id = await placeOrder();
    const res = await get(id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id,
      status: 'PENDING',
      variantId: VARIANT_ID,
      quantity: 2,
      amounts: { totalInCents: 7_500_000, currency: 'COP' },
    });
  });

  it('never returns delivery data, the customer or the provider reference', async () => {
    const id = await placeOrder();
    const { body: view } = await get(id);
    expect(view).not.toHaveProperty('delivery');
    const text = JSON.stringify(view);
    for (const secret of [
      'Calle 10',
      '3001234567',
      'ana@example.com',
      'customerId',
      'providerRef',
    ]) {
      expect(text).not.toContain(secret);
    }
  });

  it('answers 404 with a plain message for an unknown id', async () => {
    const res = await get('does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      statusCode: 404,
      code: 'TRANSACTION_NOT_FOUND',
      message: 'We could not find that order.',
    });
  });

  it.each([
    ['path traversal', '..%2F..%2Fetc%2Fpasswd'],
    ['a SQL-looking id', encodeURIComponent("1' OR '1'='1")],
    ['markup', encodeURIComponent('<script>alert(1)</script>')],
    ['a NoSQL operator', encodeURIComponent('{"$ne":""}')],
    ['an idempotency marker', 'IDEM%23key-0001-aaaa'],
    ['a very long id', 'x'.repeat(4_000)],
  ])('answers 404 for %s without echoing it', async (_label, id) => {
    const res = await get(id);
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/script|passwd|OR '1'/);
  });

  it('settles APPROVED from the provider when the webhook is late', async () => {
    const id = await placeOrder();
    built.gateway.known.set(id, { providerRef: 'prov-7', status: 'APPROVED' });
    expect((await get(id)).body.status).toBe('APPROVED');
    expect(built.catalog.stockOf(VARIANT_ID)).toBe(3);
  });

  it('settles DECLINED from the provider and gives the stock back', async () => {
    const id = await placeOrder();
    built.gateway.known.set(id, { providerRef: 'prov-7', status: 'DECLINED' });
    expect((await get(id)).body.status).toBe('DECLINED');
    expect(built.catalog.stockOf(VARIANT_ID)).toBe(5);
  });

  it('stays PENDING when the provider is unreachable, with the stock still reserved', async () => {
    const id = await placeOrder();
    built.gateway.lookupFails = true;
    const res = await get(id);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PENDING');
    expect(built.catalog.stockOf(VARIANT_ID)).toBe(3);
  });

  it('keeps a recent order PENDING while the provider does not know it yet', async () => {
    built.gateway.next = err('GATEWAY_UNAVAILABLE');
    const id = await placeOrder();
    expect((await get(id)).body.status).toBe('PENDING');
  });

  it('does not accept writes on this route', async () => {
    const id = await placeOrder();
    expect(
      (
        await request(built.app.getHttpServer())
          .put(`/transactions/${id}`)
          .send({ status: 'APPROVED' })
      ).status,
    ).toBe(404);
    expect((await request(built.app.getHttpServer()).delete(`/transactions/${id}`)).status).toBe(
      404,
    );
    expect((await get(id)).body.status).toBe('PENDING');
  });
});
