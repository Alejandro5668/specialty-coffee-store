import { err, ok, Result } from '../shared/result';
import { cleanText } from '../shared/text';

export type Delivery = {
  readonly recipientName: string;
  readonly address: string;
  readonly city: string;
  readonly phone: string;
};
export type DeliveryError = 'INVALID_FIELD' | 'INVALID_PHONE';

const PHONE = /^\+?\d{7,15}$/;

export const createDelivery = (input: Delivery): Result<Delivery, DeliveryError> => {
  const recipientName = cleanText(input.recipientName, 200);
  const address = cleanText(input.address, 200);
  const city = cleanText(input.city, 200);
  if (recipientName === null || address === null || city === null) return err('INVALID_FIELD');
  const phone = typeof input.phone === 'string' ? input.phone.trim() : '';
  if (!PHONE.test(phone)) return err('INVALID_PHONE');
  return ok({ recipientName, address, city, phone });
};
