import { RecordingLogger } from '../../../test/fakes/recording-logger';
import { config, reply } from '../../../test/fakes/http-gateway-kit';
import { HttpPaymentGateway } from './http-payment.gateway';

const charge = {
  reference: 'order-secret-ref',
  amountInCents: 2_490_000,
  customerEmail: 'ana@example.com',
  cardToken: 'tok_test_123',
  acceptanceToken: 'acc_123',
  personalAuthToken: 'per_123',
};

const build = (respond: () => Response | Promise<Response>, clock?: () => number) => {
  const logger = new RecordingLogger();
  const fetchFn = (async () => respond()) as unknown as typeof fetch;
  return { logger, gateway: new HttpPaymentGateway(config, fetchFn, logger, clock) };
};

describe('HttpPaymentGateway logging', () => {
  it('records how long a call took and how it ended, without the address or the reference', async () => {
    let now = 1_000;
    const { gateway, logger } = build(
      () => {
        now += 840;
        return reply(201, { data: { id: 'prov-1', status: 'PENDING' } });
      },
      () => now,
    );
    await gateway.charge(charge);
    expect(logger.lines).toEqual([
      {
        level: 'info',
        event: 'provider.call',
        operation: 'POST /transactions',
        status: 201,
        durationMs: 840,
      },
    ]);
  });

  it('names a lookup by its route, never by the order reference it carried', async () => {
    const { gateway, logger } = build(() => reply(404, {}));
    await gateway.findByReference('order-secret-ref');
    expect(logger.lines[0]).toMatchObject({ operation: 'GET /transactions', status: 404 });
    expect(logger.text()).not.toContain('order-secret-ref');
  });

  it('warns on a server error and on a call that never got an answer, and says which', async () => {
    const down = build(() => reply(503, {}));
    await down.gateway.charge(charge);
    expect(down.logger.lines[0]).toMatchObject({ level: 'warn', status: 503 });

    const lost = build(() => {
      throw Object.assign(new Error('The operation was aborted due to timeout'), {
        name: 'TimeoutError',
      });
    });
    await lost.gateway.charge(charge);
    expect(lost.logger.lines[0]).toMatchObject({
      level: 'warn',
      operation: 'POST /transactions',
      outcome: 'TimeoutError',
    });
    expect(lost.logger.lines[0]).not.toHaveProperty('status');
  });

  it('keeps the provider answer even if the logger itself throws', async () => {
    const throwing = {
      info: () => {
        throw new Error('logger down');
      },
      warn: () => undefined,
      error: () => undefined,
    };
    const fetchFn = (async () =>
      reply(201, { data: { id: 'prov-1', status: 'APPROVED' } })) as unknown as typeof fetch;
    const gateway = new HttpPaymentGateway(config, fetchFn, throwing);
    expect(await gateway.charge(charge)).toEqual({
      ok: true,
      value: { providerRef: 'prov-1', status: 'APPROVED' },
    });
  });

  const throwingWarn = {
    info: () => undefined,
    warn: () => {
      throw new Error('logger down');
    },
    error: () => undefined,
  };

  it('keeps a 5xx answer as it is even if the warning about it cannot be written', async () => {
    const fetchFn = (async () => reply(503, {})) as unknown as typeof fetch;
    const gateway = new HttpPaymentGateway(config, fetchFn, throwingWarn);
    expect(await gateway.charge(charge)).toEqual({ ok: false, error: 'GATEWAY_UNAVAILABLE' });
  });

  it('still reports an unknown outcome, not an exception, when the call fails and the warning cannot be written', async () => {
    const fetchFn = (async () => {
      throw new Error('connection reset');
    }) as unknown as typeof fetch;
    const gateway = new HttpPaymentGateway(config, fetchFn, throwingWarn);
    expect(await gateway.charge(charge)).toEqual({ ok: false, error: 'GATEWAY_UNAVAILABLE' });
  });

  it('never writes a key, a token, the email or the signature', async () => {
    const { gateway, logger } = build(() =>
      reply(201, { data: { id: 'prov-1', status: 'APPROVED' } }),
    );
    await gateway.charge(charge);
    await gateway.getAcceptance();
    for (const secret of [
      'prv_test_secret',
      'pub_test_public',
      'tok_test_123',
      'acc_123',
      'per_123',
      'ana@example.com',
      config.integritySecret,
    ]) {
      expect(logger.text()).not.toContain(secret);
    }
  });
});
