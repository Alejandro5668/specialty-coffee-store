import { loadDeployConfig } from '../lib/deploy-config';

const ok = {
  PAYMENT_API_URL: 'https://payments.example.test/v1/',
  PAYMENT_PUBLIC_KEY: 'pub_test_1',
};

describe('loadDeployConfig', () => {
  it('reads the payment service address and public key, without a trailing slash', () => {
    expect(loadDeployConfig(ok)).toEqual({
      paymentApiUrl: 'https://payments.example.test/v1',
      paymentPublicKey: 'pub_test_1',
    });
  });

  it.each([
    ['a missing address', { ...ok, PAYMENT_API_URL: '' }, /PAYMENT_API_URL/],
    ['an http address', { ...ok, PAYMENT_API_URL: 'http://payments.example.test' }, /https/],
    ['a missing public key', { ...ok, PAYMENT_PUBLIC_KEY: ' ' }, /PAYMENT_PUBLIC_KEY/],
  ])('refuses %s with a message that names the variable', (_label, env, message) => {
    expect(() => loadDeployConfig(env)).toThrow(message);
  });

  it('refuses a private key, so a secret cannot end up in the template by mistake', () => {
    expect(() => loadDeployConfig({ ...ok, PAYMENT_PUBLIC_KEY: 'prv_test_abc' })).toThrow(
      /public key/i,
    );
  });
});
