import { HttpException, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import proxyaddr from 'proxy-addr';

type Req = {
  app?: { get?: (key: string) => unknown };
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
  connection?: { remoteAddress?: string };
  ip?: string;
};

/**
 * Limits each client by its own address. Behind the Lambda adapter `req.ip` is always the address
 * API Gateway saw (CloudFront's edge), whatever `trust proxy` says, so every visitor would share
 * one limit. This counts the trusted proxies from the right of X-Forwarded-For, the same rule
 * Express uses, so addresses a client invents on the left are ignored.
 */
@Injectable()
export class ClientThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Req): Promise<string> {
    const hops = req.app?.get?.('trust proxy');
    const address =
      typeof hops === 'number'
        ? proxyaddr(
            req as unknown as Parameters<typeof proxyaddr>[0],
            (_address, index) => index < hops,
          )
        : (req.socket?.remoteAddress ?? req.connection?.remoteAddress ?? req.ip);
    return Promise.resolve(address ?? 'unknown');
  }

  /** The library's own message is technical; the shopper gets what happened and what to do. */
  protected throwThrottlingException(): Promise<void> {
    throw new HttpException(
      {
        statusCode: 429,
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests. Wait a minute and try again.',
      },
      429,
    );
  }
}
