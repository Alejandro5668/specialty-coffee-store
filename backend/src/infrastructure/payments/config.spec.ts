import { loadPaymentConfig } from './config';

const env = {
  PAYMENT_API_URL: 'https://sandbox.example.test/v1/',
  PAYMENT_PRIVATE_KEY: 'prv_test_x',
  PAYMENT_INTEGRITY_SECRET: 'test_integrity_x',
  PAYMENT_EVENTS_SECRET: 'test_events_x',
};

describe('loadPaymentConfig', () => {
  it('reads the settings and trims the trailing slash of the base URL', () => {
    expect(loadPaymentConfig(env)).toEqual({
      baseUrl: 'https://sandbox.example.test/v1',
      privateKey: 'prv_test_x',
      integritySecret: 'test_integrity_x',
      eventsSecret: 'test_events_x',
      timeoutMs: 10_000,
    });
  });

  it.each([
    'PAYMENT_API_URL',
    'PAYMENT_PRIVATE_KEY',
    'PAYMENT_INTEGRITY_SECRET',
    'PAYMENT_EVENTS_SECRET',
  ])('fails when %s is missing or blank', (name) => {
    expect(() => loadPaymentConfig({ ...env, [name]: undefined })).toThrow(name);
    expect(() => loadPaymentConfig({ ...env, [name]: '  ' })).toThrow(name);
  });

  it('refuses a base URL that is not https, so keys never travel in clear text', () => {
    expect(() =>
      loadPaymentConfig({ ...env, PAYMENT_API_URL: 'http://sandbox.example.test/v1' }),
    ).toThrow('https');
    expect(() => loadPaymentConfig({ ...env, PAYMENT_API_URL: 'not a url' })).toThrow(
      'PAYMENT_API_URL',
    );
  });

  it('never puts a secret in an error message', () => {
    expect.assertions(2);
    try {
      loadPaymentConfig({ ...env, PAYMENT_API_URL: 'http://x.test' });
    } catch (e) {
      expect(String(e)).toContain('https');
      expect(String(e)).not.toContain('prv_test_x');
    }
  });
});
