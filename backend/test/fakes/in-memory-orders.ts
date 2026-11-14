import { err, ok, Result } from '../../src/domain/shared/result';
import { Transaction } from '../../src/domain/transaction/transaction';
import { StockError } from '../../src/application/ports/catalog.repository';
import { OrderStore } from '../../src/application/ports/order.store';
import { InMemoryCatalog } from './in-memory-catalog';
import { InMemoryTransactions } from './in-memory-transactions';

/** No `await` between the check and the writes, so the whole placement is one atomic step. */
export class InMemoryOrders implements OrderStore {
  constructor(
    private readonly catalog: InMemoryCatalog,
    private readonly transactions: InMemoryTransactions,
  ) {}

  async place(
    key: string,
    transaction: Transaction,
  ): Promise<Result<{ transaction: Transaction; created: boolean }, StockError>> {
    const existing = this.transactions.peekByKey(key);
    if (existing) return ok({ transaction: existing, created: false });
    const reserved = this.catalog.reserveNow(transaction.variantId, transaction.quantity);
    if (!reserved.ok) return err(reserved.error);
    this.transactions.putNow(key, transaction);
    return ok({ transaction, created: true });
  }
}
