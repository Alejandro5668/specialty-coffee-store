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

describe('security headers', () => {
  it.each(['/products', '/health', '/transactions/nope'])(
    'are set on %s, errors included',
    async (path) => {
      const res = await request(server()).get(path);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['strict-transport-security']).toMatch(/max-age=\d+/);
      expect(res.headers['x-frame-options']).toBeDefined();
      expect(res.headers['content-security-policy']).toContain("default-src 'self'");
      expect(res.headers['x-powered-by']).toBeUndefined();
    },
  );

  it('forbids caching API responses, so a shopper never sees stale stock or status', async () => {
    const res = await request(server()).get('/products');
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('CORS', () => {
  const origin = 'http://localhost:5173';

  it('lets the configured frontend read responses, without credentials', async () => {
    const res = await request(server()).get('/products').set('Origin', origin);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('does not let any other site read responses', async () => {
    for (const other of ['https://evil.example.com', 'null', 'http://localhost:5174']) {
      const res = await request(server()).get('/products').set('Origin', other);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    }
  });

  it('answers the preflight for the frontend with only the methods and headers it needs', async () => {
    const res = await request(server())
      .options('/checkout')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
    expect(res.headers['access-control-allow-methods']).toBe('GET,POST');
    expect(res.headers['access-control-allow-headers']).toBe('Content-Type');
  });

  it('refuses the preflight of another site', async () => {
    const res = await request(server())
      .options('/checkout')
      .set('Origin', 'https://evil.example.com')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('payload size', () => {
  const big = (kb: number) =>
    body({ delivery: { ...(body().delivery as object), address: 'x'.repeat(kb * 1024) } });

  it('answers 413 above 16 KB, before reading the order', async () => {
    const res = await request(server()).post('/checkout').send(big(17));
    expect(res.status).toBe(413);
    expect(built.transactions.all()).toHaveLength(0);
  });

  it('accepts a normal order well under the limit', async () => {
    const res = await request(server()).post('/checkout').send(body());
    expect(res.status).toBe(201);
  });

  it('also protects the webhook', async () => {
    const res = await request(server())
      .post('/webhooks/payments')
      .send({ junk: 'x'.repeat(20 * 1024) });
    expect(res.status).toBe(413);
  });
});

describe('rate limiting', () => {
  it('answers 429 to a flood of checkouts from one client', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++)
      statuses.push((await request(server()).post('/checkout').send({})).status);
    expect(statuses.slice(0, 10).every((s) => s === 400)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });

  it('answers 429 to a flood of reads', async () => {
    let last = 0;
    for (let i = 0; i < 61; i++) last = (await request(server()).get('/products')).status;
    expect(last).toBe(429);
  });

  it('never throttles the provider webhook, which must always get through', async () => {
    for (let i = 0; i < 70; i++) {
      expect((await request(server()).post('/webhooks/payments').send({})).status).toBe(401);
    }
  });

  it('never throttles the health check', async () => {
    for (let i = 0; i < 70; i++) expect((await request(server()).get('/health')).status).toBe(200);
  });
});
