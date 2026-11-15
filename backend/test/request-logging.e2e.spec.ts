import request from 'supertest';
import { buildTestApp } from './app-factory';
import { body } from './checkout-body';

type Built = Awaited<ReturnType<typeof buildTestApp>>;
let built: Built;
beforeEach(async () => {
  built = await buildTestApp(5);
});
afterEach(async () => built.app.close());

const server = () => built.app.getHttpServer();
const lines = (event: string) => built.logs.filter((l) => l.event === event);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('one line per request', () => {
  it('gives every answer a request id the shopper can quote', async () => {
    const res = await request(server()).get('/products');
    expect(res.headers['x-request-id']).toMatch(UUID);
  });

  it('writes the method, the route pattern, the status and the time, and nothing of the address', async () => {
    const res = await request(server()).get('/transactions/some-order-id?token=secret');
    expect(lines('http.request')).toEqual([
      {
        level: 'warn',
        event: 'http.request',
        time: expect.any(String),
        requestId: res.headers['x-request-id'],
        method: 'GET',
        route: '/transactions/:id',
        status: 404,
        durationMs: expect.any(Number),
      },
    ]);
    expect(JSON.stringify(built.logs)).not.toMatch(/some-order-id|secret/);
  });

  it.each([
    ['a success', '/products', 'info'],
    ['an unknown route', '/nope/<script>alert(1)</script>', 'warn'],
  ])(
    'is %s: level %s, and a hostile address never reaches the log',
    async (_label, path, level) => {
      await request(server()).get(path);
      expect(lines('http.request')[0]).toMatchObject({ level });
      expect(JSON.stringify(built.logs)).not.toContain('script');
    },
  );

  it('does not log the health check, which a monitor calls all day', async () => {
    await request(server()).get('/health');
    expect(lines('http.request')).toHaveLength(0);
  });

  it('tells apart, on one line each, a failure of ours', async () => {
    jest.spyOn(built.catalog, 'listCatalog').mockRejectedValueOnce(new Error('boom'));
    const res = await request(server()).get('/products');
    expect(res.status).toBe(500);
    expect(lines('http.request')[0]).toMatchObject({ level: 'error', status: 500 });
    expect(lines('http.unhandled')[0]).toMatchObject({
      level: 'error',
      requestId: res.headers['x-request-id'],
    });
  });
});

describe('following one purchase', () => {
  it('shares one request id between the reservation, the charge and the request line', async () => {
    const res = await request(server()).post('/checkout').send(body());
    const id = res.headers['x-request-id'];
    expect(built.logs.map((l) => [l.event, l.requestId])).toEqual([
      ['checkout.reserved', id],
      ['payment.charged', id],
      ['http.request', id],
    ]);
  });

  it('never writes the customer, the delivery or the card token, in any line of the whole flow', async () => {
    const placed = await request(server()).post('/checkout').send(body());
    await request(server()).get(`/transactions/${placed.body.id}`);
    await request(server()).get('/checkout/options');
    const text = JSON.stringify(built.logs);
    for (const secret of [
      'Ana',
      'ana@example.com',
      'Calle 10',
      'Medellín',
      '3001234567',
      'tok_',
      'acc_',
      'per_',
    ]) {
      expect(text).not.toContain(secret);
    }
  });

  it('records a webhook that was refused, with its reason and nothing of the event', async () => {
    const placed = await request(server()).post('/checkout').send(body());
    built.logs.length = 0;
    const res = await request(server()).post('/webhooks/payments').send({
      signature: 'forged',
      reference: placed.body.id,
      providerRef: 'prov-1',
      status: 'APPROVED',
      amountInCents: 7_500_000,
    });
    expect(res.status).toBe(401);
    expect(lines('webhook.rejected')).toEqual([
      expect.objectContaining({
        level: 'warn',
        reason: 'INVALID_SIGNATURE',
        requestId: res.headers['x-request-id'],
      }),
    ]);
    expect(JSON.stringify(built.logs)).not.toMatch(/forged|prov-1/);
  });
});
