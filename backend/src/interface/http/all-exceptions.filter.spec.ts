import { ArgumentsHost, ForbiddenException, HttpException, Logger } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

const run = (error: unknown) => {
  const sent: Array<{ status: number; body: unknown }> = [];
  const reply = {
    status: (status: number) => ({ json: (body: unknown) => sent.push({ status, body }) }),
  };
  const host = { switchToHttp: () => ({ getResponse: () => reply }) } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(error, host);
  return sent[0];
};

beforeEach(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));
afterEach(() => jest.restoreAllMocks());

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
    expect(run(Object.assign(new Error('Cannot GET /x'), { status }))).toEqual({
      status,
      body: { statusCode: status, code, message },
    });
  });

  it.each([401, 403, 405, 415, 422])(
    'shows any other client error (%i) as a bad request',
    (status) => {
      expect(run(Object.assign(new Error('parser detail'), { statusCode: status }))).toEqual({
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

  it('logs the stack of a server error, and nothing for a client error', () => {
    const log = jest.spyOn(Logger.prototype, 'error');
    run(Object.assign(new Error('x'), { status: 404 }));
    expect(log).not.toHaveBeenCalled();
    run(new Error('boom'));
    expect(log).toHaveBeenCalledTimes(1);
  });
});
