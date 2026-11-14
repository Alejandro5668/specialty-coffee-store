import { Result } from '../../domain/shared/result';
import { Transaction } from '../../domain/transaction/transaction';
import { StockError } from './catalog.repository';

export interface OrderStore {
  /**
   * Atomic. A new key reserves the stock and stores the PENDING transaction together, or fails
   * without side effects. A known key returns the stored transaction untouched (`created: false`),
   * whatever the stock is now, so a duplicate submit always gets the original order.
   */
  place(
    idempotencyKey: string,
    transaction: Transaction,
  ): Promise<Result<{ transaction: Transaction; created: boolean }, StockError>>;
}
