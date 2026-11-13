import { err, Result } from './result';

export type Money = { readonly amountInCents: number; readonly currency: 'COP' };
export type MoneyError = 'INVALID_AMOUNT' | 'INVALID_QUANTITY';

export const money = (amountInCents: number): Result<Money, 'INVALID_AMOUNT'> =>
  Number.isSafeInteger(amountInCents) && amountInCents >= 0
    ? { ok: true, value: { amountInCents, currency: 'COP' } }
    : err('INVALID_AMOUNT');

export const add = (a: Money, b: Money): Result<Money, 'INVALID_AMOUNT'> =>
  money(a.amountInCents + b.amountInCents);

export const times = (a: Money, quantity: number): Result<Money, MoneyError> =>
  Number.isSafeInteger(quantity) && quantity >= 1
    ? money(a.amountInCents * quantity)
    : err('INVALID_QUANTITY');
