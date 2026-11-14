import request from 'supertest';
import { err } from '../src/domain/shared/result';
import { buildTestApp } from './app-factory';
import { body } from './checkout-body';

type Built = Awaited<ReturnType<typeof buildTestApp>>;
let built: Built;
beforeEach(async () => {
  built = await buildTestApp(5);
});
afterEach(async () => built.app.close());

const get = () => request(built.app.getHttpServer()).get('/checkout/options');

describe('GET /checkout/options', () => {
  it('returns the acceptance tokens, their links, the fees and the quantity limit', async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      acceptance: { token: 'acc_123', permalink: 'https://example.test/terms.pdf' },
      personalData: { token: 'per_123', permalink: 'https://example.test/data.pdf' },
      fees: { currency: 'COP', baseFeeInCents: 300_000, deliveryFeeInCents: 800_000 },
      maxQuantity: 10,
    });
  });

  it('is never cached and asks the provider on every call, because the tokens are single use', async () => {
    const first = await get();
    await get();
    expect(first.headers['cache-control']).toBe('no-store');
    expect(built.gateway.acceptanceCalls).toBe(2);
  });

  it('announces the same fees that checkout charges, so the summary never shows a wrong total', async () => {
    const { body: options } = await get();
    const product = (await request(built.app.getHttpServer()).get('/products')).body
      .flatMap((p: { variants: { id: string; priceInCents: number }[] }) => p.variants)
      .find((v: { id: string }) => v.id === 'huila-washed-250');
    const order = await request(built.app.getHttpServer())
      .post('/checkout')
      .send(body({ quantity: 3 }));
    expect(order.body.amounts.totalInCents).toBe(
      product.priceInCents * 3 + options.fees.baseFeeInCents + options.fees.deliveryFeeInCents,
    );
  });

  it('answers 503 with a plain message when the provider cannot be reached', async () => {
    built.gateway.acceptance = err('GATEWAY_UNAVAILABLE');
    const res = await get();
    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      statusCode: 503,
      code: 'GATEWAY_UNAVAILABLE',
      message: 'We cannot reach the payment service right now. Try again in a minute.',
    });
  });

  it('is limited to 20 calls per minute per client, since each one reaches the provider', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 22; i++) statuses.push((await get()).status);
    expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(statuses.slice(20)).toEqual([429, 429]);
  });

  it('only answers GET', async () => {
    expect(
      (await request(built.app.getHttpServer()).post('/checkout/options').send({})).status,
    ).toBe(404);
  });
});
