import { ArgumentsHost, ForbiddenException, HttpException } from '@nestjs/common';
import { RecordingLogger } from '../../../test/fakes/recording-logger';
import { AllExceptionsFilter } from './all-exceptions.filter';

let logger: RecordingLogger;

const run = (error: unknown) => {
  const sent: Array<{ status: number; body: unknown }> = [];
  const reply = {
    status: (status: number) => ({ json: (body: unknown) => sent.push({ status, body }) }),
  };
  const host = { switchToHttp: () => ({ getResponse: () => reply }) } as unknown as ArgumentsHost;
  new AllExceptionsFilter(logger).catch(error, host);
  return sent[0];
};

beforeEach(() => {
  logger = new RecordingLogger();
});

describe('AllExceptionsFilter', () => {
  it('passes the errors of the API through unchanged', () => {
    const own = { statusCode: 409, code: 'OUT_OF_STOCK', message: 'Sin stock.' };
    expect(run(new HttpException(own, 409))).toEqual({ status: 409, body: own });
  });

  it.each([
    [400, 'BAD_REQUEST', 'La petición no es válida.'],
    [404, 'NOT_FOUND', 'No encontramos lo que buscas.'],
    [413, 'PAYLOAD_TOO_LARGE', 'La petición es demasiado grande.'],
  ])('rewrites a framework %i with a stable code and a plain message', (status, code, message) => {
    expect(run(Object.assign(new Error('Cannot GET /x'), { status, expose: true }))).toEqual({
      status,
      body: { statusCode: status, code, message },
    });
  });

  it.each([401, 403, 405, 415, 422])(
    'shows any other client error (%i) as a bad request',
    (status) => {
      expect(
        run(Object.assign(new Error('parser detail'), { statusCode: status, expose: true })),
      ).toEqual({
        status: 400,
        body: { statusCode: 400, code: 'BAD_REQUEST', message: 'La petición no es válida.' },
      });
    },
  );

  it('rewrites a Nest exception that has no code of its own', () => {
    expect(run(new ForbiddenException('internal detail'))).toEqual({
      status: 400,
      body: { statusCode: 400, code: 'BAD_REQUEST', message: 'La petición no es válida.' },
    });
  });

  it.each([
    new Error('password=hunter2'),
    'a string',
    null,
    undefined,
    { status: 99 },
    { status: 700 },
  ])('answers 500 with nothing from the cause for %p', (error) => {
    const sent = run(error);
    expect(sent.status).toBe(500);
    expect(JSON.stringify(sent.body)).not.toContain('hunter2');
    expect(sent.body).toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('answers 500, not the status it carries, to a 5xx Nest exception without a code', () => {
    expect(run(new HttpException('Bad gateway', 503))).toMatchObject({
      status: 500,
      body: { code: 'INTERNAL_ERROR' },
    });
  });

  it('does nothing when the response was already sent', () => {
    const json = jest.fn();
    const reply = { headersSent: true, status: () => ({ json }) };
    const host = { switchToHttp: () => ({ getResponse: () => reply }) } as unknown as ArgumentsHost;
    expect(() => new AllExceptionsFilter().catch(new Error('late'), host)).not.toThrow();
    expect(json).not.toHaveBeenCalled();
  });

  it('does not take a server-side fault for a client error, even if it carries a 4xx status', () => {
    const upstream = Object.assign(new Error('upstream answered 403'), { status: 403 });
    expect(run(upstream)).toEqual({
      status: 500,
      body: {
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: 'Algo salió mal de nuestro lado. Inténtalo de nuevo en un minuto.',
      },
    });
    expect(logger.lines).toEqual([
      expect.objectContaining({
        level: 'error',
        event: 'http.unhandled',
        errorType: 'Error',
        detail: 'upstream answered 403',
      }),
    ]);
  });

  it('logs what the cause was, even when it is not an Error', () => {
    run({ reason: 'dynamo timeout', requestId: 'abc-123' });
    expect(logger.lines).toHaveLength(1);
    expect(String(logger.lines[0].detail)).toContain('dynamo timeout');
    expect(logger.lines[0].errorType).toBe('object');
  });

  it('logs the type, the message and the top of the stack of a server error, and nothing for a client error', () => {
    run(Object.assign(new Error('x'), { status: 404, expose: true }));
    expect(logger.lines).toHaveLength(0);
    run(new TypeError('boom'));
    expect(logger.lines).toEqual([
      expect.objectContaining({
        errorType: 'TypeError',
        detail: 'boom',
        stack: expect.stringMatching(/^\s+at /),
      }),
    ]);
  });

  it('writes the message once, in `detail` with its limit, and keeps only the frames in `stack`', () => {
    const error = new Error('provider said: ana@example.com');
    error.stack = `Error: provider said: ana@example.com\n    at first (a.ts:1:1)\n    at second (b.ts:2:2)`;
    run(error);
    expect(logger.lines[0].detail).toBe('provider said: ana@example.com');
    expect(logger.lines[0].stack).toBe('    at first (a.ts:1:1)\n    at second (b.ts:2:2)');
  });

  it('does not write the body of the request, only what failed', () => {
    run(new Error('failed for ana@example.com'));
    expect(Object.keys(logger.lines[0]).sort()).toEqual([
      'detail',
      'errorType',
      'event',
      'level',
      'stack',
    ]);
  });
});
