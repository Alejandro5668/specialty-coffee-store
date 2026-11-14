import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { HttpConfig } from './http-config';

export const MAX_BODY = '16kb';

/** Everything that protects the HTTP surface. Used by the server and by the tests, so they cannot drift apart. */
export const configureApp = (app: NestExpressApplication, config: HttpConfig): void => {
  app.set('trust proxy', config.trustProxyHops);
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
