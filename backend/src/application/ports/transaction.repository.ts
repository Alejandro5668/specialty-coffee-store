import { Transaction } from '../../domain/transaction/transaction';

export interface TransactionRepository {
  findById(id: string): Promise<Transaction | null>;
  findByIdempotencyKey(key: string): Promise<Transaction | null>;
}
