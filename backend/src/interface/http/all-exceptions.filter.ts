import { inspect } from 'node:util';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Inject } from '@nestjs/common';

import { EventLogger, silentLogger } from '../../application/ports/event-logger';
import { TOKENS } from '../../composition/tokens';

type Reply = { headersSent?: boolean; status(code: number): { json(body: unknown): void } };

/** What a shopper reads when the framework itself rejects a request. */
const FRAMEWORK_ERRORS: Record<number, { code: string; message: string }> = {
  400: { code: 'BAD_REQUEST', message: 'La petición no es válida.' },
  404: { code: 'NOT_FOUND', message: 'No encontramos lo que buscas.' },
  413: { code: 'PAYLOAD_TOO_LARGE', message: 'La petición es demasiado grande.' },
};
const INTERNAL = {
  code: 'INTERNAL_ERROR',
  message: 'Algo salió mal de nuestro lado. Inténtalo de nuevo en un minuto.',
};

/**
 * Only errors that say they are meant for the client count as client errors: Nest exceptions and
 * the parser's http-errors (`expose: true`). A fault from an adapter that happens to carry a 4xx
 * `status` (an upstream 403, say) is a server fault and is answered and logged as one.
 */
/**
 * The frames of a stack, without its first line, which repeats the message: the message is
 * logged once, in `detail`, with the shorter limit, so a long one cannot reach the log twice.
 */
const frames = (stack: string | undefined): string | undefined =>
  stack
    ?.split('\n')
    .filter((line) => /^\s+at /.test(line))
    .join('\n');

const statusOf = (error: unknown): number => {
  if (error instanceof HttpException) return error.getStatus();
  const { status, statusCode, expose } = (error ?? {}) as Record<string, unknown>;
  const code = typeof status === 'number' ? status : statusCode;
  return expose === true && typeof code === 'number' && code >= 400 && code < 500 ? code : 500;
};

/**
 * The API's own errors already carry a stable `code` and a plain message, so they pass through
 * unchanged. Everything else (unknown routes, malformed JSON, oversized bodies, bugs) is
 * rewritten, so no parser text, path or stack ever reaches the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(@Inject(TOKENS.logger) private readonly logger: EventLogger = silentLogger) {}

  catch(error: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<Reply>();
    if (reply.headersSent) return;
    if (error instanceof HttpException) {
      const body = error.getResponse();
      if (typeof body === 'object' && body !== null && 'code' in body) {
        reply.status(error.getStatus()).json(body);
        return;
      }
    }
    const status = statusOf(error);
    if (status >= 500) {
      // What went wrong, for whoever is paged: the type, the message and the top of the stack.
      this.logger.error('http.unhandled', {
        errorType: error instanceof Error ? error.name : typeof error,
        detail: error instanceof Error ? error.message : inspect(error, { depth: 2 }),
        stack: error instanceof Error ? frames(error.stack) : undefined,
      });
      reply.status(500).json({ statusCode: 500, ...INTERNAL });
      return;
    }
    // Any other client error (415, 405...) is, for the shopper, a request that cannot be served.
    const shown = FRAMEWORK_ERRORS[status] ? status : 400;
    reply.status(shown).json({ statusCode: shown, ...FRAMEWORK_ERRORS[shown] });
  }
}
