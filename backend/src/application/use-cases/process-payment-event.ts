import { err, ok, Result } from '../../domain/shared/result';
import { Transaction } from '../../domain/transaction/transaction';
import { OrderStore } from '../ports/order.store';
import { EventLogger, silentLogger } from '../ports/event-logger';
import { EventError, EventVerifier } from '../ports/event.verifier';
import { TransactionRepository } from '../ports/transaction.repository';
import { SettleTransaction } from '../settle-transaction';

export type ProcessEventError = EventError | 'UNKNOWN_TRANSACTION' | 'AMOUNT_MISMATCH';

export class ProcessPaymentEvent {
  private readonly settler: SettleTransaction;

  constructor(
    private readonly verifier: EventVerifier,
    private readonly transactions: TransactionRepository,
    orders: OrderStore,
    private readonly logger: EventLogger = silentLogger,
  ) {
    this.settler = new SettleTransaction(orders, transactions, logger);
  }

  async execute(payload: unknown): Promise<Result<Transaction, ProcessEventError>> {
    const result = await this.process(payload);
    // Only the reason and the order id: never the body, the signature or the provider's data.
    if (result.ok) {
      this.logger.info('webhook.accepted', {
        orderId: result.value.id,
        status: result.value.status,
      });
    } else {
      this.logger.warn('webhook.rejected', { reason: result.error });
    }
    return result;
  }

  private async process(payload: unknown): Promise<Result<Transaction, ProcessEventError>> {
    const event = this.verifier.verify(payload);
    if (!event.ok) return event;

    const transaction = await this.transactions.findById(event.value.reference);
    if (!transaction) return err('UNKNOWN_TRANSACTION');
    if (event.value.amountInCents !== transaction.amounts.total.amountInCents) {
      return err('AMOUNT_MISMATCH');
    }
    if (event.value.status === 'PENDING') return ok(transaction);

    return ok(
      await this.settler.execute(
        transaction,
        event.value.status,
        event.value.providerRef,
        'webhook',
      ),
    );
  }
}
