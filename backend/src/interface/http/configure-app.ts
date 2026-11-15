import { randomUUID } from 'node:crypto';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { EventLogger } from '../../application/ports/event-logger';
import { TOKENS } from '../../composition/tokens';
import { requestContext } from '../../infrastructure/logging/json-logger';
import { HttpConfig } from './http-config';

export const MAX_BODY = '16kb';

type Req = { method: string; path: string; route?: { path?: unknown } };
type Res = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  on(event: 'finish', fn: () => void): void;
};

/**
 * Gives each request an id, returned in `X-Request-Id` so a shopper can quote it, and writes one
 * line when it ends: the method, the route pattern (never the address, which may be hostile or
 * hold an id), the status and the time. The health check is left out: a monitor calls it all day.
 */
const requestLog = (logger: EventLogger) => (req: Req, res: Res, next: () => void) => {
  const requestId = randomUUID();
  const started = process.hrtime.bigint();
  res.setHeader('X-Request-Id', requestId);
  res.on('finish', () => {
    if (req.path === '/health') return;
    const status = res.statusCode;
    const route = typeof req.route?.path === 'string' ? req.route.path : '(none)';
    const durationMs = Math.round(Number(process.hrtime.bigint() - started) / 1e6);
    requestContext.run({ requestId }, () =>
      logger[status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info']('http.request', {
        method: req.method,
        route,
        status,
        durationMs,
      }),
    );
  });
  requestContext.run({ requestId }, next);
};

/** Everything that protects the HTTP surface. Used by the server and by the tests, so they cannot drift apart. */
export const configureApp = (app: NestExpressApplication, config: HttpConfig): void => {
  app.set('trust proxy', config.trustProxyHops);
  app.use(requestLog(app.get<EventLogger>(TOKENS.logger)));
  app.use(helmet());
  app.use(
    (_req: unknown, res: { setHeader(name: string, value: string): void }, next: () => void) => {
      res.setHeader('Cache-Control', 'no-store');
      next();
    },
  );
  app.enableCors({
    origin: config.corsOrigins,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    maxAge: 600,
  });
  app.useBodyParser('json', { limit: MAX_BODY });
};
