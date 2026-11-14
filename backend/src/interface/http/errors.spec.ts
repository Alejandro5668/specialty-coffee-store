import { HttpException } from '@nestjs/common';
import { err, ok } from '../../domain/shared/result';
import { API_ERRORS, unwrap } from './errors';

const thrown = (code: keyof typeof API_ERRORS): HttpException => {
  try {
    unwrap(err(code));
  } catch (e) {
    return e as HttpException;
  }
  throw new Error('expected unwrap to throw');
};

describe('unwrap', () => {
  it('returns the value of an ok result', () => {
    expect(unwrap(ok({ a: 1 }))).toEqual({ a: 1 });
  });

  it.each([
    ['INVALID_INPUT', 422],
    ['AMOUNT_MISMATCH', 422],
    ['VARIANT_NOT_FOUND', 404],
    ['TRANSACTION_NOT_FOUND', 404],
    ['UNKNOWN_TRANSACTION', 404],
    ['OUT_OF_STOCK', 409],
    ['INVALID_SIGNATURE', 401],
    ['MALFORMED_EVENT', 400],
  ] as const)('maps %s to HTTP %i', (code, status) => {
    const error = thrown(code);
    expect(error.getStatus()).toBe(status);
    expect(error.getResponse()).toMatchObject({ statusCode: status, code });
  });

  it.each(Object.keys(API_ERRORS) as Array<keyof typeof API_ERRORS>)(
    'gives %s a plain message with no technical detail',
    (code) => {
      const { message } = thrown(code).getResponse() as { message: string };
      expect(message.length).toBeGreaterThan(10);
      expect(message).not.toMatch(/exception|stack|undefined|null|sql|dynamo/i);
    },
  );
});
