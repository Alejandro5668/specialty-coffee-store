import { TransactionCanceledException } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  TransactWriteCommand,
  TransactWriteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { err, ok, Result } from '../../domain/shared/result';
import { assignShipment } from '../../domain/shipment/shipment';
import { Transaction } from '../../domain/transaction/transaction';
import { StockError } from '../../application/ports/catalog.repository';
import { OrderStore } from '../../application/ports/order.store';
import { TransactionRepository } from '../../application/ports/transaction.repository';
import { DynamoConfig } from './config';
import { fromShipment, fromTransaction, IDEMPOTENCY_PREFIX } from './mappers';

const FAILED = 'ConditionalCheckFailed';

const reasons = (error: unknown) =>
  error instanceof TransactionCanceledException ? (error.CancellationReasons ?? []) : null;

export class DynamoOrderStore implements OrderStore {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly config: DynamoConfig,
    private readonly transactions: TransactionRepository,
  ) {}

  async place(
    key: string,
    transaction: Transaction,
  ): Promise<Result<{ transaction: Transaction; created: boolean }, StockError>> {
    const { variants, transactions } = this.config.tables;
    try {
      await this.client.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: transactions,
                Item: {
                  id: `${IDEMPOTENCY_PREFIX}${key}`,
                  transactionId: transaction.id,
                  createdAt: transaction.createdAt,
                },
                ConditionExpression: 'attribute_not_exists(id)',
              },
            },
            {
              Update: {
                TableName: variants,
                Key: { id: transaction.variantId },
                UpdateExpression: 'SET stock = stock - :q',
                ConditionExpression: 'attribute_exists(id) AND stock >= :q',
                ExpressionAttributeValues: { ':q': transaction.quantity },
                ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
              },
            },
            {
              Put: {
                TableName: transactions,
                Item: fromTransaction(transaction),
                ConditionExpression: 'attribute_not_exists(id)',
              },
            },
          ],
        }),
      );
      return ok({ transaction, created: true });
    } catch (error) {
      return this.explainPlaceFailure(error, key);
    }
  }

  async settle(transaction: Transaction): Promise<boolean> {
    const { transactions } = this.config.tables;
    const order = {
      TableName: transactions,
      Key: { id: transaction.id },
      UpdateExpression: 'SET #s = :s, providerRef = :p',
      ConditionExpression: '#s = :pending',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':s': transaction.status,
        ':p': transaction.providerRef,
        ':pending': 'PENDING',
      },
    };

    try {
      await this.client.send(
        new TransactWriteCommand({
          // Approved: the delivery is assigned in the same step. Otherwise the stock goes back.
          TransactItems: [{ Update: order }, this.secondLeg(transaction)],
        }),
      );
      return true;
    } catch (error) {
      // Only the first leg (the PENDING condition) means "already settled"; anything else is a real failure.
      if (reasons(error)?.[0]?.Code === FAILED && reasons(error)?.[1]?.Code !== FAILED)
        return false;
      throw error;
    }
  }

  private secondLeg(
    transaction: Transaction,
  ): NonNullable<TransactWriteCommandInput['TransactItems']>[number] {
    const shipment = assignShipment(transaction);
    if (shipment.ok) {
      return {
        Put: {
          TableName: this.config.tables.deliveries,
          Item: fromShipment(shipment.value),
          ConditionExpression: 'attribute_not_exists(id)',
        },
      };
    }
    return {
      Update: {
        TableName: this.config.tables.variants,
        Key: { id: transaction.variantId },
        UpdateExpression: 'SET stock = stock + :q',
        ConditionExpression: 'attribute_exists(id)',
        ExpressionAttributeValues: { ':q': transaction.quantity },
      },
    };
  }

  private async explainPlaceFailure(
    error: unknown,
    key: string,
  ): Promise<Result<{ transaction: Transaction; created: boolean }, StockError>> {
    const list = reasons(error);
    if (list === null) throw error;
    // The key marker comes first, so a duplicate submit always wins over a stock failure.
    if (list[0]?.Code === FAILED) {
      const existing = await this.transactions.findByIdempotencyKey(key);
      if (existing) return ok({ transaction: existing, created: false });
      throw error;
    }
    if (list[1]?.Code === FAILED) {
      return err(list[1].Item ? 'INSUFFICIENT_STOCK' : 'VARIANT_NOT_FOUND');
    }
    throw error;
  }
}
