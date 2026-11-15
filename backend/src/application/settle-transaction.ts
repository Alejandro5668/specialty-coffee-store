import { FinalStatus, settle, Transaction } from '../domain/transaction/transaction';
import { EventLogger, silentLogger } from './ports/event-logger';
import { OrderStore } from './ports/order.store';
import { TransactionRepository } from './ports/transaction.repository';

export type SettleSource = 'charge' | 'webhook' | 'polling' | 'expired';

/** Moves a PENDING transaction to its final status exactly once; the store frees the stock in the same step unless it was approved. */
export class SettleTransaction {
  constructor(
    private readonly orders: OrderStore,
    private readonly transactions: TransactionRepository,
    private readonly logger: EventLogger = silentLogger,
  ) {}

  async execute(
    transaction: Transaction,
    status: FinalStatus,
    providerRef: string | null,
    source?: SettleSource,
  ): Promise<Transaction> {
    const settled = settle(transaction, status, providerRef);
    if (settled.ok && (await this.orders.settle(settled.value))) {
      this.logger.info('order.settled', {
        orderId: transaction.id,
        status,
        source,
        stockReleased: status !== 'APPROVED',
        deliveryAssigned: status === 'APPROVED',
      });
      return settled.value;
    }
    // Another path (the webhook, the status check) settled it first: nothing is done twice.
    const current = (await this.transactions.findById(transaction.id)) ?? transaction;
    this.logger.info('order.settle_skipped', {
      orderId: transaction.id,
      wanted: status,
      current: current.status,
      source,
    });
    return current;
  }
}
