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

const post = (payload: unknown) =>
  request(built.app.getHttpServer())
    .post('/checkout')
    .send(payload as object);
const untouched = () => {
  expect(built.gateway.charges).toHaveLength(0);
  expect(built.transactions.all()).toHaveLength(0);
  expect(built.catalog.stockOf(VARIANT_ID)).toBe(5);
};

describe('POST /checkout: wrong shape is a 400 that names the fields and never echoes the input', () => {
  it.each([
    ['an array', []],
    ['text', 'hello'],
    ['null', null],
    ['an empty object', {}],
  ])('rejects %s', async (_label, payload) => {
    const res = await post(payload);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ statusCode: 400, code: 'VALIDATION_FAILED' });
    untouched();
  });

  it.each([
    ['quantity as text', { quantity: '2' }, 'quantity'],
    ['quantity as null', { quantity: null }, 'quantity'],
    ['idempotencyKey as a number', { idempotencyKey: 12345678 }, 'idempotencyKey'],
    ['variantId as an object', { variantId: { $ne: '' } }, 'variantId'],
    ['no customer', { customer: undefined }, 'customer.name'],
    ['customer as text', { customer: 'ana' }, 'customer.email'],
    ['no delivery', { delivery: null }, 'delivery.address'],
    ['no card token', { cardToken: undefined }, 'cardToken'],
    ['token as a number', { acceptanceToken: 5 }, 'acceptanceToken'],
  ])('rejects %s', async (_label, over, field) => {
    const res = await post(body(over));
    expect(res.status).toBe(400);
    expect(res.body.fields).toContain(field);
    untouched();
  });

  it('does not reflect hostile input back in the error', async () => {
    const res = await post(body({ quantity: '<script>alert(1)</script>' }));
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain('script');
  });

  it('rejects malformed JSON and other content types', async () => {
    const bad = await request(built.app.getHttpServer())
      .post('/checkout')
      .set('Content-Type', 'application/json')
      .send('{"quantity": ');
    expect(bad.status).toBe(400);
    const text = await request(built.app.getHttpServer())
      .post('/checkout')
      .set('Content-Type', 'text/plain')
      .send('quantity=2');
    expect(text.status).toBe(400);
    untouched();
  });
});

describe('POST /checkout: right shape, wrong rules is a 422', () => {
  it.each([
    ['zero quantity', { quantity: 0 }],
    ['negative quantity', { quantity: -3 }],
    ['fractional quantity', { quantity: 1.5 }],
    ['quantity above the order limit', { quantity: 11 }],
    ['huge quantity', { quantity: 1_000_000_000 }],
    ['quantity that overflows to Infinity', { __raw: '"quantity":1e999' }],
    [
      'script in the address',
      { delivery: { ...(body().delivery as object), address: '<script>alert(1)</script>' } },
    ],
    [
      'markup in the name',
      { customer: { name: '<img src=x onerror=alert(1)>', email: 'ana@example.com' } },
    ],
    [
      'control characters in the city',
      { delivery: { ...(body().delivery as object), city: 'Cali\u0000\n' } },
    ],
    ['bad email', { customer: { name: 'Ana', email: 'not-an-email' } }],
    ['bad phone', { delivery: { ...(body().delivery as object), phone: 'call me' } }],
    [
      'oversized address',
      { delivery: { ...(body().delivery as object), address: 'x'.repeat(5_000) } },
    ],
    ['short idempotency key', { idempotencyKey: 'x' }],
    ['empty card token', { cardToken: '' }],
    ['card token that is not a token', { cardToken: '4242 4242 4242 4242' }],
  ])('rejects %s', async (_label, over) => {
    const raw = (over as { __raw?: string }).__raw;
    const res = raw
      ? await request(built.app.getHttpServer())
          .post('/checkout')
          .set('Content-Type', 'application/json')
          .send(JSON.stringify(body()).replace('"quantity":2', raw))
      : await post(body(over));
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('INVALID_INPUT');
    expect(JSON.stringify(res.body)).not.toMatch(/script|onerror|4242/);
    untouched();
  });
});
