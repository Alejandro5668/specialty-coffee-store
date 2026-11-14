import { Transaction } from '../../domain/transaction/transaction';

export interface TransactionRepository {
  /** Put-if-absent by idempotency key; `created` is false when the key already existed. */
  createIfAbsent(
    idempotencyKey: string,
    transaction: Transaction,
  ): Promise<{ transaction: Transaction; created: boolean }>;
  findById(id: string): Promise<Transaction | null>;
  findByIdempotencyKey(key: string): Promise<Transaction | null>;
  /** Conditional write: only succeeds while the stored transaction is still PENDING. */
  saveSettled(transaction: Transaction): Promise<boolean>;
}
