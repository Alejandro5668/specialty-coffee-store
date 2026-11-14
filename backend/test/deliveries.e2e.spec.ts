import request from 'supertest';
import { buildTestApp } from './app-factory';
import { body } from './checkout-body';
import { VARIANT_ID } from './fakes/fixtures';

type Built = Awaited<ReturnType<typeof buildTestApp>>;
let built: Built;
beforeEach(async () => {
  built = await buildTestApp(5);
});
afterEach(async () => built.app.close());

const server = () => built.app.getHttpServer();
const getDelivery = (id: string) => request(server()).get(`/deliveries/${id}`);
const placeOrder = async (): Promise<string> =>
  (await request(server()).post('/checkout').send(body())).body.id as string;
const settleWith = async (id: string, status: 'APPROVED' | 'DECLINED') => {
  built.gateway.known.set(id, { providerRef: 'prov-7', status });
  await request(server()).get(`/transactions/${id}`);
};

describe('GET /deliveries/:id', () => {
  it('assigns the purchased product to the shopper once the payment is approved', async () => {
    const id = await placeOrder();
    await settleWith(id, 'APPROVED');
    const res = await getDelivery(id);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id, status: 'ASSIGNED', variantId: VARIANT_ID, quantity: 2 });
  });

  it('never returns the address, the phone, the recipient or the customer', async () => {
    const id = await placeOrder();
    await settleWith(id, 'APPROVED');
    const text = JSON.stringify((await getDelivery(id)).body);
    for (const secret of ['Calle 10', '3001234567', 'ana@example.com', 'customerId', 'Ana']) {
      expect(text).not.toContain(secret);
    }
  });

  it('answers 404 while the payment is still PENDING', async () => {
    const id = await placeOrder();
    const res = await getDelivery(id);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      statusCode: 404,
      code: 'DELIVERY_NOT_FOUND',
      message: 'No hay una entrega para ese pedido.',
    });
  });

  it('answers 404 when the payment was declined, and the stock goes back', async () => {
    const id = await placeOrder();
    await settleWith(id, 'DECLINED');
    expect((await getDelivery(id)).status).toBe(404);
    expect(built.catalog.stockOf(VARIANT_ID)).toBe(5);
  });

  it('keeps one delivery when the same payment is reported twice', async () => {
    const id = await placeOrder();
    await settleWith(id, 'APPROVED');
    await settleWith(id, 'APPROVED');
    expect(built.shipments.count()).toBe(1);
  });

  it.each([
    ['path traversal', '..%2F..%2Fetc%2Fpasswd'],
    ['markup', encodeURIComponent('<script>alert(1)</script>')],
    ['a NoSQL operator', encodeURIComponent('{"$ne":""}')],
    ['a very long id', 'x'.repeat(4_000)],
  ])('answers 404 for %s without echoing it', async (_label, id) => {
    const res = await getDelivery(id);
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/script|passwd|\$ne/);
  });

  it('does not accept writes on this route', async () => {
    const id = await placeOrder();
    await settleWith(id, 'APPROVED');
    expect((await request(server()).put(`/deliveries/${id}`).send({ status: 'X' })).status).toBe(
      404,
    );
    expect((await request(server()).delete(`/deliveries/${id}`)).status).toBe(404);
    expect((await getDelivery(id)).body.status).toBe('ASSIGNED');
  });
});
