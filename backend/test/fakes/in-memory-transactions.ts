import { Transaction } from '../../src/domain/transaction/transaction';
import { TransactionRepository } from '../../src/application/ports/transaction.repository';

export class InMemoryTransactions implements TransactionRepository {
  private readonly byId = new Map<string, Transaction>();
  private readonly byKey = new Map<string, string>();

  async createIfAbsent(key: string, transaction: Transaction) {
    const existingId = this.byKey.get(key);
    if (existingId) return { transaction: this.byId.get(existingId)!, created: false };
    this.byKey.set(key, transaction.id);
    this.byId.set(transaction.id, transaction);
    return { transaction, created: true };
  }

  async findById(id: string): Promise<Transaction | null> {
    return this.byId.get(id) ?? null;
  }

  async findByIdempotencyKey(key: string): Promise<Transaction | null> {
    const id = this.byKey.get(key);
    return id ? (this.byId.get(id) ?? null) : null;
  }

  async saveSettled(transaction: Transaction): Promise<boolean> {
    const current = this.byId.get(transaction.id);
    if (!current || current.status !== 'PENDING') return false;
    this.byId.set(transaction.id, transaction);
    return true;
  }

  all(): Transaction[] {
    return [...this.byId.values()];
  }
}
