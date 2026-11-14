import request from 'supertest';
import { buildTestApp } from './app-factory';
import { body } from './checkout-body';
import { VARIANT_ID } from './fakes/fixtures';

type Built = Awaited<ReturnType<typeof buildTestApp>>;
let built: Built;
let id: string;

beforeEach(async () => {
  built = await buildTestApp(5);
  const res = await request(built.app.getHttpServer()).post('/checkout').send(body());
  id = res.body.id;
});
afterEach(async () => built.app.close());

const event = (over: Record<string, unknown> = {}) => ({
  signature: 'valid',
  reference: id,
  providerRef: 'prov-1',
  status: 'APPROVED',
  amountInCents: 7_500_000,
  ...over,
});
const send = (payload: unknown) =>
  request(built.app.getHttpServer())
    .post('/webhooks/payments')
    .send(payload as object);
const status = async () =>
  (await request(built.app.getHttpServer()).get(`/transactions/${id}`)).body.status;

describe('POST /webhooks/payments', () => {
  it('answers 200 and settles an approved payment, keeping the stock sold', async () => {
    const res = await send(event());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(await status()).toBe('APPROVED');
    expect(built.catalog.stockOf(VARIANT_ID)).toBe(3);
  });

  it.each(['DECLINED', 'ERROR'])('settles %s and gives the stock back', async (s) => {
    expect((await send(event({ status: s }))).status).toBe(200);
    expect(await status()).toBe(s);
    expect(built.catalog.stockOf(VARIANT_ID)).toBe(5);
  });

  it('answers 401 to a forged signature and changes nothing', async () => {
    const res = await send(event({ signature: 'forged' }));
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_SIGNATURE');
    expect(await status()).toBe('PENDING');
    expect(built.catalog.stockOf(VARIANT_ID)).toBe(3);
  });

  it('answers 401 when there is no signature at all', async () => {
    expect((await send({ reference: id, status: 'APPROVED' })).status).toBe(401);
    expect((await send({})).status).toBe(401);
    expect(await status()).toBe('PENDING');
  });

  it('is idempotent: a replayed event changes nothing and frees the stock once', async () => {
    const first = await send(event({ status: 'DECLINED' }));
    const replay = await send(event({ status: 'DECLINED' }));
    expect([first.status, replay.status]).toEqual([200, 200]);
    expect(await status()).toBe('DECLINED');
    expect(built.catalog.stockOf(VARIANT_ID)).toBe(5);
  });

  it('frees the stock once when the same event arrives in parallel', async () => {
    const results = await Promise.all([
      send(event({ status: 'DECLINED' })),
      send(event({ status: 'DECLINED' })),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(built.catalog.stockOf(VARIANT_ID)).toBe(5);
  });

  it('ignores a later conflicting event once the payment is final', async () => {
    await send(event({ status: 'APPROVED' }));
    await send(event({ status: 'DECLINED' }));
    expect(await status()).toBe('APPROVED');
    expect(built.catalog.stockOf(VARIANT_ID)).toBe(3);
  });

  it('answers 422 when the amount does not match the order, and changes nothing', async () => {
    const res = await send(event({ amountInCents: 100 }));
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('AMOUNT_MISMATCH');
    expect(await status()).toBe('PENDING');
  });

  it('answers 404 for an unknown order', async () => {
    const res = await send(event({ reference: 'nope' }));
    expect(res.status).toBe(404);
    expect(built.catalog.stockOf(VARIANT_ID)).toBe(3);
  });

  it('answers 400 to a body that is not JSON', async () => {
    const res = await request(built.app.getHttpServer())
      .post('/webhooks/payments')
      .set('Content-Type', 'application/json')
      .send('{"event": ');
    expect(res.status).toBe(400);
  });

  it('only answers POST', async () => {
    expect((await request(built.app.getHttpServer()).get('/webhooks/payments')).status).toBe(404);
  });
});
