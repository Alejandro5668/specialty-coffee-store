import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { err, ok } from '../src/domain/shared/result';
import { buildTestApp } from './app-factory';
import { body } from './checkout-body';
import { VARIANT_ID } from './fakes/fixtures';

type Built = Awaited<ReturnType<typeof buildTestApp>>;
let built: Built;
const post = (payload: unknown) =>
  request(built.app.getHttpServer())
    .post('/checkout')
    .send(payload as object);

const start = async (stock = 5) => {
  built = await buildTestApp(stock);
  return built.app as INestApplication;
};
afterEach(async () => built?.app.close());

describe('POST /checkout', () => {
  it('creates a PENDING order, charges the backend total once and reserves the stock', async () => {
    await start();
    const res = await post(body());
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      status: 'PENDING',
      variantId: VARIANT_ID,
      quantity: 2,
      amounts: {
        currency: 'COP',
        productAmountInCents: 6_400_000,
        baseFeeInCents: 300_000,
        deliveryFeeInCents: 800_000,
        totalInCents: 7_500_000,
      },
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(built.gateway.charges).toHaveLength(1);
    expect(built.gateway.charges[0]).toMatchObject({
      amountInCents: 7_500_000,
      reference: res.body.id,
    });
    expect(built.catalog.stockOf(VARIANT_ID)).toBe(3);
  });

  it('never returns the delivery data, the customer or the provider reference', async () => {
    await start();
    const text = JSON.stringify((await post(body())).body);
    for (const secret of [
      'Calle 10',
      '3001234567',
      'ana@example.com',
      'customerId',
      'providerRef',
      'tok_test_123',
    ]) {
      expect(text).not.toContain(secret);
    }
  });

  it('ignores prices, totals and any other field the client invents', async () => {
    await start();
    const res = await post(
      body({
        price: 1,
        total: 1,
        amountInCents: 1,
        amounts: { total: { amountInCents: 1 } },
        isAdmin: true,
      }),
    );
    expect(res.status).toBe(201);
    expect(res.body.amounts.totalInCents).toBe(7_500_000);
    expect(built.gateway.charges[0].amountInCents).toBe(7_500_000);
  });

  it('answers APPROVED when the provider approves right away', async () => {
    await start();
    built.gateway.next = ok({ providerRef: 'prov-9', status: 'APPROVED' });
    const res = await post(body());
    expect(res.body.status).toBe('APPROVED');
    expect(built.catalog.stockOf(VARIANT_ID)).toBe(3);
  });

  it('answers DECLINED and gives the stock back when the card is declined', async () => {
    await start();
    built.gateway.next = ok({ providerRef: 'prov-9', status: 'DECLINED' });
    const res = await post(body());
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('DECLINED');
    expect(built.catalog.stockOf(VARIANT_ID)).toBe(5);
  });

  it('answers ERROR and gives the stock back when the provider refuses the request', async () => {
    await start();
    built.gateway.next = err('GATEWAY_REJECTED');
    const res = await post(body());
    expect(res.body.status).toBe('ERROR');
    expect(built.catalog.stockOf(VARIANT_ID)).toBe(5);
  });

  it('stays PENDING with the stock reserved when the provider times out', async () => {
    await start();
    built.gateway.next = err('GATEWAY_UNAVAILABLE');
    const res = await post(body());
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    expect(built.catalog.stockOf(VARIANT_ID)).toBe(3);
  });

  it('creates one order and one charge on a double submit, even in parallel', async () => {
    await start();
    const [a, b] = await Promise.all([post(body()), post(body())]);
    const again = await post(body());
    expect([a.status, b.status, again.status]).toEqual([201, 201, 201]);
    expect(new Set([a.body.id, b.body.id, again.body.id]).size).toBe(1);
    expect(built.gateway.charges).toHaveLength(1);
    expect(built.catalog.stockOf(VARIANT_ID)).toBe(3);
  });

  it('lets exactly one of two buyers take the last unit', async () => {
    await start(1);
    const [a, b] = await Promise.all([
      post(body({ idempotencyKey: 'key-0001-aaaa', quantity: 1 })),
      post(body({ idempotencyKey: 'key-0002-bbbb', quantity: 1 })),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(built.catalog.stockOf(VARIANT_ID)).toBe(0);
    expect(built.gateway.charges).toHaveLength(1);
  });

  it('answers 409 with a plain message when there is not enough stock', async () => {
    await start(1);
    const res = await post(body({ quantity: 2 }));
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      statusCode: 409,
      code: 'OUT_OF_STOCK',
      message: 'There is not enough stock for that quantity. Choose fewer units.',
    });
    expect(built.gateway.charges).toHaveLength(0);
  });

  it('answers 404 for a variant that does not exist', async () => {
    await start();
    const res = await post(body({ variantId: 'nope' }));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('VARIANT_NOT_FOUND');
  });
});
