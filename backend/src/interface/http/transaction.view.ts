import { Transaction, TransactionStatus } from '../../domain/transaction/transaction';

/** What a shopper may see. Delivery data, customer and provider reference stay on the server. */
export type TransactionView = {
  id: string;
  status: TransactionStatus;
  variantId: string;
  quantity: number;
  amounts: {
    currency: 'COP';
    productAmountInCents: number;
    baseFeeInCents: number;
    deliveryFeeInCents: number;
    totalInCents: number;
  };
  createdAt: string;
};

export const toTransactionView = (t: Transaction): TransactionView => ({
  id: t.id,
  status: t.status,
  variantId: t.variantId,
  quantity: t.quantity,
  amounts: {
    currency: 'COP',
    productAmountInCents: t.amounts.productAmount.amountInCents,
    baseFeeInCents: t.amounts.baseFee.amountInCents,
    deliveryFeeInCents: t.amounts.deliveryFee.amountInCents,
    totalInCents: t.amounts.total.amountInCents,
  },
  createdAt: t.createdAt,
});
