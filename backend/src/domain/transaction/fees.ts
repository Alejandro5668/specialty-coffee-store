import { add, Money, MoneyError, times } from '../shared/money';
import { err, ok, Result } from '../shared/result';
import { Amounts } from './transaction';

export const BASE_FEE_CENTS = 300_000;
export const DELIVERY_FEE_CENTS = 800_000;
export const MAX_QUANTITY = 10;

const cop = (amountInCents: number): Money => ({ amountInCents, currency: 'COP' });

export const calculateAmounts = (
  unitPrice: Money,
  quantity: number,
): Result<Amounts, MoneyError> => {
  if (quantity > MAX_QUANTITY) return err('INVALID_QUANTITY');
  const productAmount = times(unitPrice, quantity);
  if (!productAmount.ok) return productAmount;

  const baseFee = cop(BASE_FEE_CENTS);
  const deliveryFee = cop(DELIVERY_FEE_CENTS);
  const withBase = add(productAmount.value, baseFee);
  if (!withBase.ok) return withBase;
  const total = add(withBase.value, deliveryFee);
  if (!total.ok) return total;

  return ok({ productAmount: productAmount.value, baseFee, deliveryFee, total: total.value });
};
