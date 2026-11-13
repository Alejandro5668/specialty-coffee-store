import { add, Money } from '../shared/money';
import { err, ok, Result } from '../shared/result';
import { Delivery } from './delivery';

export type FinalStatus = 'APPROVED' | 'DECLINED' | 'ERROR';
export type TransactionStatus = 'PENDING' | FinalStatus;

export type Amounts = {
  readonly productAmount: Money;
  readonly baseFee: Money;
  readonly deliveryFee: Money;
  readonly total: Money;
};

export type Transaction = {
  readonly id: string;
  readonly status: TransactionStatus;
  readonly customerId: string;
  readonly variantId: string;
  readonly quantity: number;
  readonly amounts: Amounts;
  readonly delivery: Delivery;
  readonly providerRef: string | null;
  readonly createdAt: string;
};

export type TransactionError =
  'INVALID_QUANTITY' | 'AMOUNT_MISMATCH' | 'INVALID_STATUS' | 'ALREADY_FINAL';

type NewTransaction = Omit<Transaction, 'status' | 'providerRef'>;

const FINAL: readonly TransactionStatus[] = ['APPROVED', 'DECLINED', 'ERROR'];

const sumOf = ({ productAmount, baseFee, deliveryFee }: Amounts): number | null => {
  const partial = add(productAmount, baseFee);
  const sum = partial.ok ? add(partial.value, deliveryFee) : partial;
  return sum.ok ? sum.value.amountInCents : null;
};

export const createTransaction = (input: NewTransaction): Result<Transaction, TransactionError> => {
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1) return err('INVALID_QUANTITY');
  if (sumOf(input.amounts) !== input.amounts.total.amountInCents) return err('AMOUNT_MISMATCH');
  return ok({ ...input, status: 'PENDING', providerRef: null });
};

export const settle = (
  transaction: Transaction,
  status: FinalStatus,
  providerRef: string,
): Result<Transaction, TransactionError> => {
  if (!FINAL.includes(status)) return err('INVALID_STATUS');
  if (transaction.status !== 'PENDING') return err('ALREADY_FINAL');
  return ok({ ...transaction, status, providerRef });
};
