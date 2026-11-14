import { Logger } from '@nestjs/common';
import request from 'supertest';
import { buildTestApp } from './app-factory';
import { body } from './checkout-body';

type Built = Awaited<ReturnType<typeof buildTestApp>>;
let built: Built;
let id: string;
let logged: string[];

beforeEach(async () => {
  built = await buildTestApp(5);
  id = (await request(built.app.getHttpServer()).post('/checkout').send(body())).body.id;
  logged = [];
  jest
    .spyOn(Logger.prototype, 'log')
    .mockImplementation((m: unknown) => void logged.push(String(m)));
  jest
    .spyOn(Logger.prototype, 'warn')
    .mockImplementation((m: unknown) => void logged.push(String(m)));
});
afterEach(async () => {
  jest.restoreAllMocks();
  await built.app.close();
});

const send = (payload: object) =>
  request(built.app.getHttpServer()).post('/webhooks/payments').send(payload);
const event = (over: Record<string, unknown> = {}) => ({
  signature: 'valid',
  reference: id,
  providerRef: 'prov-1',
  status: 'APPROVED',
  amountInCents: 7_500_000,
  ...over,
});

describe('webhook logging', () => {
  it('says why an event was rejected, so a wrong checksum is visible', async () => {
    await send(event({ signature: 'forged' }));
    expect(logged).toEqual(['Webhook rejected: INVALID_SIGNATURE']);
  });

  it.each([
    ['an unknown order', () => event({ reference: 'nope' }), 'UNKNOWN_TRANSACTION'],
    ['a different amount', () => event({ amountInCents: 1 }), 'AMOUNT_MISMATCH'],
  ])('names the reason for %s', async (_label, payload, code) => {
    await send(payload());
    expect(logged).toEqual([`Webhook rejected: ${code}`]);
  });

  it('records an accepted event with the order and the final status, nothing else', async () => {
    await send(event());
    expect(logged).toEqual([`Webhook accepted: order ${id} is APPROVED`]);
  });

  it('never writes the body, the signature or any secret to the log', async () => {
    await send(event({ signature: 'forged' }));
    await send(event());
    const text = logged.join('\n');
    expect(text).not.toMatch(/forged|\bvalid\b|prov-1|7500000|checksum|secret/i);
  });
});
