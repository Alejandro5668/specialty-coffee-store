import { CheckoutInput } from '../../application/use-cases/checkout';
import { validationFailed } from './errors';

type Json = Record<string, unknown>;

const asObject = (value: unknown): Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : {};

/**
 * Checks only the shape (is each field present and of the right type). The rules (length,
 * characters, ranges) belong to the use case. Unknown fields are dropped, so a forged price or
 * total never reaches it.
 */
export const parseCheckoutBody = (raw: unknown): CheckoutInput => {
  const root = asObject(raw);
  const customer = asObject(root.customer);
  const delivery = asObject(root.delivery);

  const bad: string[] = [];
  const text = (path: string, value: unknown): string => {
    if (typeof value !== 'string') bad.push(path);
    return value as string;
  };
  const number = (path: string, value: unknown): number => {
    if (typeof value !== 'number') bad.push(path);
    return value as number;
  };

  const input: CheckoutInput = {
    idempotencyKey: text('idempotencyKey', root.idempotencyKey),
    variantId: text('variantId', root.variantId),
    quantity: number('quantity', root.quantity),
    customer: {
      name: text('customer.name', customer.name),
      email: text('customer.email', customer.email),
    },
    delivery: {
      recipientName: text('delivery.recipientName', delivery.recipientName),
      address: text('delivery.address', delivery.address),
      city: text('delivery.city', delivery.city),
      phone: text('delivery.phone', delivery.phone),
    },
    cardToken: text('cardToken', root.cardToken),
    acceptanceToken: text('acceptanceToken', root.acceptanceToken),
    personalAuthToken: text('personalAuthToken', root.personalAuthToken),
  };
  if (bad.length > 0) throw validationFailed(bad);
  return input;
};
