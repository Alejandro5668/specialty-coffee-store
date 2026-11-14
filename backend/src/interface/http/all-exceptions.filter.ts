import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';

type Reply = { status(code: number): { json(body: unknown): void } };

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

const statusOf = (error: unknown): number => {
  if (error instanceof HttpException) return error.getStatus();
  const { status, statusCode } = (error ?? {}) as { status?: unknown; statusCode?: unknown };
  const code = typeof status === 'number' ? status : statusCode;
  return typeof code === 'number' && code >= 400 && code < 600 ? code : 500;
};

/**
 * The API's own errors already carry a stable `code` and a plain message, so they pass through
 * unchanged. Everything else (unknown routes, malformed JSON, oversized bodies, bugs) is
 * rewritten, so no parser text, path or stack ever reaches the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(error: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<Reply>();
    if (error instanceof HttpException) {
      const body = error.getResponse();
      if (typeof body === 'object' && body !== null && 'code' in body) {
        reply.status(error.getStatus()).json(body);
        return;
      }
    }
    const status = statusOf(error);
    if (status >= 500) {
      this.logger.error(error instanceof Error ? error.stack : String(error));
      reply.status(500).json({ statusCode: 500, ...INTERNAL });
      return;
    }
    // Any other client error (415, 405...) is, for the shopper, a request that cannot be served.
    const shown = FRAMEWORK_ERRORS[status] ? status : 400;
    reply.status(shown).json({ statusCode: shown, ...FRAMEWORK_ERRORS[shown] });
  }
}
