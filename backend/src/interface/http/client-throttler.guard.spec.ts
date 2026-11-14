import { ClientThrottlerGuard } from './client-throttler.guard';

type Req = {
  app?: { get: (k: string) => unknown };
  socket?: { remoteAddress?: string };
  headers: Record<string, string>;
  ip?: string;
  connection?: { remoteAddress?: string };
};
const req = (hops: unknown, remote: string, xff?: string): Req => ({
  app: { get: (key: string) => (key === 'trust proxy' ? hops : undefined) },
  socket: { remoteAddress: remote },
  connection: { remoteAddress: remote },
  headers: xff ? { 'x-forwarded-for': xff } : {},
});
const tracker = (r: Req) =>
  (
    ClientThrottlerGuard.prototype as unknown as { getTracker: (r: Req) => Promise<string> }
  ).getTracker(r);

describe('ClientThrottlerGuard tracker', () => {
  it('uses the address of the connection when no proxy is trusted, whatever X-Forwarded-For says', async () => {
    expect(await tracker(req(0, '203.0.113.7', '1.2.3.4'))).toBe('203.0.113.7');
  });

  it('takes the viewer from X-Forwarded-For counting the trusted proxies from the right', async () => {
    expect(await tracker(req(1, '130.176.0.9', '9.9.9.9'))).toBe('9.9.9.9');
    expect(await tracker(req(2, '130.176.0.9', '9.9.9.9, 130.176.0.1'))).toBe('9.9.9.9');
  });

  it('cannot be fooled by addresses added on the left', async () => {
    expect(await tracker(req(1, '130.176.0.9', '6.6.6.6, 5.5.5.5, 9.9.9.9'))).toBe('9.9.9.9');
  });

  it('falls back to the connection when there is nothing to read', async () => {
    expect(await tracker(req(1, '192.0.2.50'))).toBe('192.0.2.50');
  });

  it('still returns something when the request has no address at all', async () => {
    expect(await tracker({ headers: {} })).toBe('unknown');
  });
});
