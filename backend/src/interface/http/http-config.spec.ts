import { loadHttpConfig } from './http-config';

describe('loadHttpConfig', () => {
  it('defaults to the local frontend and no proxy', () => {
    expect(loadHttpConfig({})).toEqual({
      corsOrigins: ['http://localhost:5173'],
      trustProxyHops: 0,
    });
  });

  it('reads a comma-separated list of origins and the proxy hops', () => {
    expect(
      loadHttpConfig({
        CORS_ORIGIN: 'https://shop.example.com, https://www.example.com',
        TRUST_PROXY_HOPS: '1',
      }),
    ).toEqual({
      corsOrigins: ['https://shop.example.com', 'https://www.example.com'],
      trustProxyHops: 1,
    });
  });

  it.each([
    '*',
    'https://shop.example.com,*',
    'null',
    'ftp://example.com',
    'not a url',
    '   ',
    'https://a.com/path',
  ])('refuses the CORS origin %p, so the API is never open to every site', (origin) => {
    expect(() => loadHttpConfig({ CORS_ORIGIN: origin })).toThrow('CORS_ORIGIN');
  });

  it.each(['-1', '1.5', 'abc', '99'])('refuses TRUST_PROXY_HOPS=%p', (hops) => {
    expect(() => loadHttpConfig({ TRUST_PROXY_HOPS: hops })).toThrow('TRUST_PROXY_HOPS');
  });
});
