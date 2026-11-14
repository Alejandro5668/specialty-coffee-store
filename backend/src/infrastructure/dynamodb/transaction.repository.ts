import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { Transaction } from '../../domain/transaction/transaction';
import { TransactionRepository } from '../../application/ports/transaction.repository';
import { DynamoConfig } from './config';
import { IDEMPOTENCY_PREFIX, toTransaction } from './mappers';

export class DynamoTransactionRepository implements TransactionRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly config: DynamoConfig,
  ) {}

  async findById(id: string): Promise<Transaction | null> {
    // Idempotency markers live in the same table; they are never a transaction.
    if (typeof id !== 'string' || id === '' || id.startsWith(IDEMPOTENCY_PREFIX)) return null;
    const item = await this.get(id);
    return item ? toTransaction(item) : null;
  }

  async findByIdempotencyKey(key: string): Promise<Transaction | null> {
    const marker = await this.get(`${IDEMPOTENCY_PREFIX}${key}`);
    return marker ? this.findById(String(marker.transactionId)) : null;
  }

  private async get(id: string): Promise<Record<string, unknown> | null> {
    const { Item } = await this.client.send(
      new GetCommand({
        TableName: this.config.tables.transactions,
        Key: { id },
        ConsistentRead: true,
      }),
    );
    return Item ?? null;
  }
}
