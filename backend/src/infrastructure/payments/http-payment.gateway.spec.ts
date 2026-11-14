import { ChargeRequest } from '../../application/ports/payment.gateway';
import { gatewayWith, reply } from '../../../test/fakes/http-gateway-kit';

const request: ChargeRequest = {
  reference: 'sk8-438k4-xmxm392-sn2m',
  amountInCents: 2_490_000,
  customerEmail: 'ana@example.com',
  cardToken: 'tok_test_123',
  acceptanceToken: 'acc_123',
  personalAuthToken: 'per_123',
};

describe('HttpPaymentGateway.charge', () => {
  it('posts the payment with the private key and the integrity signature', async () => {
    const { gateway, calls } = gatewayWith(() =>
      reply(201, { data: { id: 'prov-1', status: 'PENDING' } }),
    );
    const result = await gateway.charge(request);

    expect(result).toEqual({ ok: true, value: { providerRef: 'prov-1', status: 'PENDING' } });
    expect(calls[0].url).toBe('https://sandbox.example.test/v1/transactions');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(
      'Bearer prv_test_secret',
    );
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      acceptance_token: 'acc_123',
      accept_personal_auth: 'per_123',
      amount_in_cents: 2_490_000,
      currency: 'COP',
      customer_email: 'ana@example.com',
      reference: 'sk8-438k4-xmxm392-sn2m',
      signature: '37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5',
      payment_method: { type: 'CARD', token: 'tok_test_123', installments: 1 },
    });
  });

  it('sets a timeout so a hanging provider cannot hang a purchase', async () => {
    const { gateway, calls } = gatewayWith(() =>
      reply(201, { data: { id: 'p', status: 'PENDING' } }),
    );
    await gateway.charge(request);
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ['APPROVED', 'APPROVED'],
    ['DECLINED', 'DECLINED'],
    ['ERROR', 'ERROR'],
    ['PENDING', 'PENDING'],
    ['VOIDED', 'DECLINED'],
    ['SOMETHING_NEW', 'PENDING'],
  ])('maps the provider status %s to %s', async (provider, ours) => {
    const { gateway } = gatewayWith(() => reply(201, { data: { id: 'p', status: provider } }));
    expect(await gateway.charge(request)).toEqual({
      ok: true,
      value: { providerRef: 'p', status: ours },
    });
  });

  it.each([400, 401, 403, 404, 422])(
    'rejects on a %s: the provider refused the request',
    async (status) => {
      const { gateway } = gatewayWith(() =>
        reply(status, { error: { type: 'INPUT_VALIDATION_ERROR' } }),
      );
      expect(await gateway.charge(request)).toEqual({ ok: false, error: 'GATEWAY_REJECTED' });
    },
  );

  it.each([408, 429, 500, 502, 503, 504])(
    'is unavailable on a %s: the outcome is unknown',
    async (status) => {
      const { gateway } = gatewayWith(() => reply(status, '<html>busy</html>'));
      expect(await gateway.charge(request)).toEqual({ ok: false, error: 'GATEWAY_UNAVAILABLE' });
    },
  );

  it('is unavailable on a network error or a timeout', async () => {
    const failing = gatewayWith(() => Promise.reject(new TypeError('fetch failed'))).gateway;
    expect(await failing.charge(request)).toEqual({ ok: false, error: 'GATEWAY_UNAVAILABLE' });
    const timeout = gatewayWith(() =>
      Promise.reject(new DOMException('timed out', 'TimeoutError')),
    ).gateway;
    expect(await timeout.charge(request)).toEqual({ ok: false, error: 'GATEWAY_UNAVAILABLE' });
  });

  it.each([['not json'], [{ data: {} }], [{}], [{ data: { id: 42, status: 'APPROVED' } }]])(
    'is unavailable when a success response has no usable transaction: %p',
    async (body) => {
      const { gateway } = gatewayWith(() => reply(201, body as string));
      expect(await gateway.charge(request)).toEqual({ ok: false, error: 'GATEWAY_UNAVAILABLE' });
    },
  );
});

describe('HttpPaymentGateway.findByReference', () => {
  it('finds the transaction by reference, URL-encoded', async () => {
    const { gateway, calls } = gatewayWith(() =>
      reply(200, { data: [{ id: 'prov-1', status: 'APPROVED', reference: 'a b&c' }] }),
    );
    const result = await gateway.findByReference('a b&c');
    expect(result).toEqual({ ok: true, value: { providerRef: 'prov-1', status: 'APPROVED' } });
    expect(calls[0].url).toBe('https://sandbox.example.test/v1/transactions?reference=a%20b%26c');
    expect(calls[0].init.method).toBe('GET');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(
      'Bearer prv_test_secret',
    );
  });

  it('ignores results whose reference does not match', async () => {
    const { gateway } = gatewayWith(() =>
      reply(200, { data: [{ id: 'x', status: 'APPROVED', reference: 'other' }] }),
    );
    expect(await gateway.findByReference('mine')).toEqual({ ok: true, value: null });
  });

  it.each([[{ data: [] }], [{ data: null }], [{}]])(
    'returns null when the provider has nothing: %p',
    async (body) => {
      const { gateway } = gatewayWith(() => reply(200, body));
      expect(await gateway.findByReference('mine')).toEqual({ ok: true, value: null });
    },
  );

  it('returns null on a 404', async () => {
    const { gateway } = gatewayWith(() => reply(404, {}));
    expect(await gateway.findByReference('mine')).toEqual({ ok: true, value: null });
  });

  it.each([401, 429, 500, 503])('is unavailable on a %s', async (status) => {
    const { gateway } = gatewayWith(() => reply(status, '<html>busy</html>'));
    expect(await gateway.findByReference('mine')).toEqual({
      ok: false,
      error: 'GATEWAY_UNAVAILABLE',
    });
  });

  it('is unavailable on a network error', async () => {
    const { gateway } = gatewayWith(() => Promise.reject(new TypeError('fetch failed')));
    expect(await gateway.findByReference('mine')).toEqual({
      ok: false,
      error: 'GATEWAY_UNAVAILABLE',
    });
  });
});
