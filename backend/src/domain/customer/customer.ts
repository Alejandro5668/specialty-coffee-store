import { err, ok, Result } from '../shared/result';
import { cleanText } from '../shared/text';

export type Customer = { readonly id: string; readonly name: string; readonly email: string };
export type CustomerError = 'INVALID_NAME' | 'INVALID_EMAIL';

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export const createCustomer = (input: Customer): Result<Customer, CustomerError> => {
  const name = cleanText(input.name, 100);
  if (name === null) return err('INVALID_NAME');
  const email = typeof input.email === 'string' ? input.email.trim() : '';
  if (email.length > 254 || !EMAIL.test(email)) return err('INVALID_EMAIL');
  return ok({ id: input.id, name, email });
};
