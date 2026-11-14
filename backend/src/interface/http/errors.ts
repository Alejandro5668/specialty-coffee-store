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
      'Algunos datos del pedido no son válidos. Revisa la cantidad, el correo, el teléfono y la dirección, e inténtalo de nuevo.',
  },
  AMOUNT_MISMATCH: { status: 422, message: 'El importe del pago no coincide con el pedido.' },
  VARIANT_NOT_FOUND: { status: 404, message: 'Ese tamaño de café no está disponible.' },
  TRANSACTION_NOT_FOUND: { status: 404, message: 'No encontramos ese pedido.' },
  DELIVERY_NOT_FOUND: { status: 404, message: 'No hay una entrega para ese pedido.' },
  UNKNOWN_TRANSACTION: { status: 404, message: 'No encontramos ese pedido.' },
  OUT_OF_STOCK: {
    status: 409,
    message: 'No hay stock suficiente para esa cantidad. Elige menos unidades.',
  },
  INVALID_SIGNATURE: { status: 401, message: 'La firma del evento no es válida.' },
  MALFORMED_EVENT: { status: 400, message: 'El evento no es válido.' },
  GATEWAY_UNAVAILABLE: {
    status: 503,
    message:
      'No podemos conectar con el servicio de pagos en este momento. Inténtalo de nuevo en un minuto.',
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
      message: 'Faltan datos en la petición o tienen un tipo incorrecto.',
      fields,
    },
    400,
  );
