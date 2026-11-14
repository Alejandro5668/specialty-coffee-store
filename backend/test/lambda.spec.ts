import type { Handler } from 'aws-lambda';
import { toHandler } from '../src/lambda/to-handler';
import { buildTestApp } from './app-factory';
import { body as order } from './checkout-body';
import { VARIANT_ID } from './fakes/fixtures';
import { context, event, Reply } from './lambda-events';

type Built = Awaited<ReturnType<typeof buildTestApp>>;
let built: Built;
let handler: Handler;

const start = async (config: { trustProxyHops?: number } = {}) => {
  built = await buildTestApp(5, config);
  handler = toHandler(built.app);
};
const call = async (e: ReturnType<typeof event>) =>
  (await handler(e, context, () => undefined)) as Reply;
const json = (r: Reply) => JSON.parse(r.body as string);

afterEach(async () => built?.app.close());

describe('Lambda handler: the API through API Gateway events', () => {
  it('answers a read with the JSON, the security headers and no caching', async () => {
    await start();
    const reply = await call(event('GET', '/products'));
    expect(reply.statusCode).toBe(200);
    expect(json(reply)).toHaveLength(6);
    expect(reply.headers['content-type']).toContain('application/json');
    expect(reply.headers['x-content-type-options']).toBe('nosniff');
    expect(reply.headers['strict-transport-security']).toMatch(/max-age/);
    expect(reply.headers['cache-control']).toBe('no-store');
  });

  it('takes an order from a JSON body and reserves the stock', async () => {
    await start();
    const reply = await call(event('POST', '/checkout', { body: order() }));
    expect(reply.statusCode).toBe(201);
    expect(json(reply)).toMatchObject({ status: 'PENDING', quantity: 2 });
    expect(built.catalog.stockOf(VARIANT_ID)).toBe(3);
  });

  it('also takes a body that API Gateway sent encoded in base64', async () => {
    await start();
    const reply = await call(event('POST', '/checkout', { body: order(), base64: true }));
    expect(reply.statusCode).toBe(201);
  });

  it('keeps the query string and the path parameters', async () => {
    await start();
    const reply = await call(event('GET', '/transactions/does-not-exist', { query: 'a=1&b=2' }));
    expect(reply.statusCode).toBe(404);
    expect(json(reply)).toMatchObject({ code: 'TRANSACTION_NOT_FOUND' });
  });

  it('answers 400 to malformed JSON and 413 above 16 KB, without creating anything', async () => {
    await start();
    expect((await call(event('POST', '/checkout', { body: '{"quantity": ' }))).statusCode).toBe(
      400,
    );
    const big = order({
      delivery: { ...(order().delivery as object), address: 'x'.repeat(17 * 1024) },
    });
    expect((await call(event('POST', '/checkout', { body: big }))).statusCode).toBe(413);
    expect(built.transactions.all()).toHaveLength(0);
  });

  it('answers 404 JSON for a route that does not exist, never an HTML page', async () => {
    await start();
    const reply = await call(event('GET', '/nope'));
    expect(reply.statusCode).toBe(404);
    expect(reply.headers['content-type']).toContain('application/json');
  });

  it('serves the Swagger document and the Swagger UI', async () => {
    await start();
    const doc = await call(event('GET', '/docs/openapi.json'));
    expect(doc.statusCode).toBe(200);
    expect(Object.keys(json(doc).paths)).toContain('/checkout');
    const ui = await call(event('GET', '/docs'));
    expect(ui.statusCode).toBe(200);
    expect(ui.headers['content-type']).toContain('text/html');
  });

  it('only lets the configured methods through CORS, and never reflects an unknown origin', async () => {
    await start();
    const reply = await call(
      event('GET', '/products', { headers: { origin: 'https://evil.example.com' } }),
    );
    expect(reply.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('Lambda handler: one limit per client', () => {
  const checkout = (ip: string, headers: Record<string, string> = {}) =>
    call(event('POST', '/checkout', { body: {}, ip, headers }));

  it('limits each client by the address API Gateway reports, so one client never uses the others up', async () => {
    await start();
    const codes: number[] = [];
    for (let i = 0; i < 11; i++) codes.push((await checkout('198.51.100.1')).statusCode);
    expect(codes.slice(0, 10).every((c) => c === 400)).toBe(true);
    expect(codes[10]).toBe(429);
    expect((await checkout('198.51.100.2')).statusCode).toBe(400);
  });

  it('behind CloudFront it limits by the viewer address in X-Forwarded-For, not by the shared edge address', async () => {
    await start({ trustProxyHops: 1 });
    const viewer = (ip: string) => checkout('130.176.0.9', { 'x-forwarded-for': ip });
    const codes: number[] = [];
    for (let i = 0; i < 11; i++) codes.push((await viewer('9.9.9.9')).statusCode);
    expect(codes[10]).toBe(429);
    expect((await viewer('8.8.8.8')).statusCode).toBe(400);
  });

  it('ignores addresses a client invents at the start of X-Forwarded-For', async () => {
    await start({ trustProxyHops: 1 });
    const codes: number[] = [];
    for (let i = 0; i < 11; i++)
      codes.push(
        (await checkout('130.176.0.9', { 'x-forwarded-for': `6.6.6.${i}, 9.9.9.9` })).statusCode,
      );
    expect(codes[10]).toBe(429);
  });

  it('counts two proxies when asked to, as when API Gateway also adds its own hop', async () => {
    await start({ trustProxyHops: 2 });
    const viewer = (ip: string) =>
      checkout('10.0.0.5', { 'x-forwarded-for': `${ip}, 130.176.0.9` });
    const codes: number[] = [];
    for (let i = 0; i < 11; i++) codes.push((await viewer('9.9.9.9')).statusCode);
    expect(codes[10]).toBe(429);
    expect((await viewer('8.8.8.8')).statusCode).toBe(400);
  });

  it('falls back to the address of the connection when there is no X-Forwarded-For', async () => {
    await start({ trustProxyHops: 1 });
    const codes: number[] = [];
    for (let i = 0; i < 11; i++) codes.push((await checkout('192.0.2.50')).statusCode);
    expect(codes[10]).toBe(429);
  });
});
