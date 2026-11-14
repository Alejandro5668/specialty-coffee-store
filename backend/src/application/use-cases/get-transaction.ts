import { err, ok, Result } from '../../domain/shared/result';
import { Transaction } from '../../domain/transaction/transaction';
import { CatalogRepository } from '../ports/catalog.repository';
import { PaymentGateway } from '../ports/payment.gateway';
import { Clock } from '../ports/system.ports';
import { TransactionRepository } from '../ports/transaction.repository';
import { SettleTransaction } from '../settle-transaction';

export type GetTransactionError = 'TRANSACTION_NOT_FOUND';

/** A PENDING transaction the provider does not know about is only called failed after this long. */
export const UNKNOWN_GRACE_MS = 5 * 60 * 1000;

export class GetTransaction {
  private readonly settler: SettleTransaction;

  constructor(
    private readonly transactions: TransactionRepository,
    private readonly gateway: PaymentGateway,
    catalog: CatalogRepository,
    private readonly clock: Clock,
  ) {
    this.settler = new SettleTransaction(transactions, catalog);
  }

  async execute(id: string): Promise<Result<Transaction, GetTransactionError>> {
    const transaction = typeof id === 'string' ? await this.transactions.findById(id) : null;
    if (!transaction) return err('TRANSACTION_NOT_FOUND');
    if (transaction.status !== 'PENDING') return ok(transaction);
    return ok(await this.reconcile(transaction));
  }

  /** Webhooks are the main path; this is the fallback when one is late or lost. */
  private async reconcile(transaction: Transaction): Promise<Transaction> {
    const found = await this.gateway.findByReference(transaction.id);
    if (!found.ok) return transaction;

    if (found.value === null) {
      return this.isOlderThanGrace(transaction)
        ? this.settler.execute(transaction, 'ERROR', null)
        : transaction;
    }
    const { status, providerRef } = found.value;
    return status === 'PENDING'
      ? transaction
      : this.settler.execute(transaction, status, providerRef);
  }

  private isOlderThanGrace(transaction: Transaction): boolean {
    return Date.parse(this.clock.now()) - Date.parse(transaction.createdAt) > UNKNOWN_GRACE_MS;
  }
}
