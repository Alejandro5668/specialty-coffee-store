import { FinalStatus, settle, Transaction } from '../domain/transaction/transaction';
import { CatalogRepository } from './ports/catalog.repository';
import { TransactionRepository } from './ports/transaction.repository';

/** Moves a PENDING transaction to its final status exactly once and frees the stock if it was not approved. */
export class SettleTransaction {
  constructor(
    private readonly transactions: TransactionRepository,
    private readonly catalog: CatalogRepository,
  ) {}

  async execute(
    transaction: Transaction,
    status: FinalStatus,
    providerRef: string | null,
  ): Promise<Transaction> {
    const settled = settle(transaction, status, providerRef);
    if (settled.ok && (await this.transactions.saveSettled(settled.value))) {
      if (status !== 'APPROVED') {
        await this.catalog.releaseStock(transaction.variantId, transaction.quantity);
      }
      return settled.value;
    }
    return (await this.transactions.findById(transaction.id)) ?? transaction;
  }
}
