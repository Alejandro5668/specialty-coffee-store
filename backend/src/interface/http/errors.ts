import { HttpException } from '@nestjs/common';
import { Result } from '../../domain/shared/result';

/**
 * Every error a use case can return, with its HTTP status and a plain message for the shopper.
 * `code` is stable for the frontend; `message` never carries technical detail.
 */
export const API_ERRORS = {
  INVALID_INPUT: {
    status: 422,
    message:
      'Some order details are not valid. Check the quantity, email, phone and address, then try again.',
  },
  AMOUNT_MISMATCH: { status: 422, message: 'The payment amount does not match the order.' },
  VARIANT_NOT_FOUND: { status: 404, message: 'That coffee size is not available.' },
  TRANSACTION_NOT_FOUND: { status: 404, message: 'We could not find that order.' },
  UNKNOWN_TRANSACTION: { status: 404, message: 'We could not find that order.' },
  OUT_OF_STOCK: {
    status: 409,
    message: 'There is not enough stock for that quantity. Choose fewer units.',
  },
  INVALID_SIGNATURE: { status: 401, message: 'The event signature is not valid.' },
  MALFORMED_EVENT: { status: 400, message: 'The event is not valid.' },
  GATEWAY_UNAVAILABLE: {
    status: 503,
    message: 'We cannot reach the payment service right now. Try again in a minute.',
  },
} as const;

export type ApiErrorCode = keyof typeof API_ERRORS;

export const apiError = (code: ApiErrorCode): HttpException => {
  const { status, message } = API_ERRORS[code];
  return new HttpException({ statusCode: status, code, message }, status);
};

/** A use case error that has no entry in API_ERRORS does not compile. */
export const unwrap = <T>(result: Result<T, ApiErrorCode>): T => {
  if (result.ok) return result.value;
  throw apiError(result.error);
};

/** A body of the wrong shape. Lists field names only, so hostile input is never echoed back. */
export const validationFailed = (fields: string[]): HttpException =>
  new HttpException(
    {
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'The request is missing data or has the wrong type of data.',
      fields,
    },
    400,
  );
