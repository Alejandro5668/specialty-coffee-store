import { gatewayWith, reply } from '../../../test/fakes/http-gateway-kit';

describe('HttpPaymentGateway.getAcceptance', () => {
  const merchant = {
    data: {
      presigned_acceptance: {
        acceptance_token: 'eyJ.acc',
        permalink: 'https://example.test/terms.pdf',
        type: 'END_USER_POLICY',
      },
      presigned_personal_data_auth: {
        acceptance_token: 'eyJ.per',
        permalink: 'https://example.test/data.pdf',
        type: 'PERSONAL_DATA_AUTH',
      },
    },
  };
  const withAcceptance = (over: object) => ({
    data: {
      ...merchant.data,
      presigned_acceptance: { ...merchant.data.presigned_acceptance, ...over },
    },
  });
  const withPersonal = (over: object) => ({
    data: {
      ...merchant.data,
      presigned_personal_data_auth: { ...merchant.data.presigned_personal_data_auth, ...over },
    },
  });

  it('reads both tokens with the public key header and never sends the private key', async () => {
    const { gateway, calls } = gatewayWith(() => reply(200, merchant));
    const result = await gateway.getAcceptance();

    expect(result).toEqual({
      ok: true,
      value: {
        acceptance: { token: 'eyJ.acc', permalink: 'https://example.test/terms.pdf' },
        personalData: { token: 'eyJ.per', permalink: 'https://example.test/data.pdf' },
      },
    });
    expect(calls[0].url).toBe('https://sandbox.example.test/v1/merchants/info');
    expect(calls[0].init.method).toBe('GET');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['x-merchant-public-key']).toBe('pub_test_public');
    expect(headers.Authorization).toBeUndefined();
    expect(JSON.stringify(calls[0])).not.toContain('prv_test_secret');
  });

  it.each([400, 401, 404, 429, 500, 503])('is unavailable on a %s', async (status) => {
    const { gateway } = gatewayWith(() => reply(status, '<html>busy</html>'));
    expect(await gateway.getAcceptance()).toEqual({ ok: false, error: 'GATEWAY_UNAVAILABLE' });
  });

  it('is unavailable on a network error or a timeout', async () => {
    const { gateway } = gatewayWith(() => Promise.reject(new TypeError('fetch failed')));
    expect(await gateway.getAcceptance()).toEqual({ ok: false, error: 'GATEWAY_UNAVAILABLE' });
  });

  it.each([
    ['not json', 'nope'],
    ['no data', {}],
    ['a missing token', withAcceptance({ acceptance_token: undefined })],
    ['an empty token', withPersonal({ acceptance_token: '' })],
    ['a link that is not https', withAcceptance({ permalink: 'http://example.test/t.pdf' })],
    ['a link that is not a URL', withAcceptance({ permalink: 'javascript:alert(1)' })],
  ])(
    'is unavailable when the answer has %s, so a hostile link never reaches the shopper',
    async (_label, body) => {
      const { gateway } = gatewayWith(() => reply(200, body as string));
      expect(await gateway.getAcceptance()).toEqual({ ok: false, error: 'GATEWAY_UNAVAILABLE' });
    },
  );
});
