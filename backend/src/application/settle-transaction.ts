import { FinalStatus, settle, Transaction } from '../domain/transaction/transaction';
import { OrderStore } from './ports/order.store';
import { TransactionRepository } from './ports/transaction.repository';

/** Moves a PENDING transaction to its final status exactly once; the store frees the stock in the same step unless it was approved. */
export class SettleTransaction {
  constructor(
    private readonly orders: OrderStore,
    private readonly transactions: TransactionRepository,
  ) {}

  async execute(
    transaction: Transaction,
    status: FinalStatus,
    providerRef: string | null,
  ): Promise<Transaction> {
    const settled = settle(transaction, status, providerRef);
    if (settled.ok && (await this.orders.settle(settled.value))) return settled.value;
    return (await this.transactions.findById(transaction.id)) ?? transaction;
  }
}
