import {
  AttributeValue,
  DynamoDBClient,
  TransactionCanceledException,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { Transaction } from '../src/domain/transaction/transaction';
import { loadDynamoConfig } from '../src/infrastructure/dynamodb/config';
import { DynamoOrderStore } from '../src/infrastructure/dynamodb/order.store';
import { DynamoTransactionRepository } from '../src/infrastructure/dynamodb/transaction.repository';

export const config = loadDynamoConfig({});
export const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: config.region }));
export const ddb = mockClient(client);
export const store = () =>
  new DynamoOrderStore(client, config, new DynamoTransactionRepository(client, config));

export const cop = (amountInCents: number) => ({ amountInCents, currency: 'COP' as const });
export const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't1',
  status: 'PENDING',
  customerId: 'c1',
  variantId: 'huila-washed-250',
  quantity: 2,
  amounts: {
    productAmount: cop(6_400_000),
    baseFee: cop(300_000),
    deliveryFee: cop(800_000),
    total: cop(7_500_000),
  },
  delivery: { recipientName: 'Ana', address: 'Calle 1', city: 'Cali', phone: '3001234567' },
  providerRef: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

export const canceled = (
  ...codes: Array<string | { Code: string; Item?: Record<string, AttributeValue> }>
) =>
  new TransactionCanceledException({
    message: 'Transaction cancelled',
    $metadata: {},
    CancellationReasons: codes.map((c) => (typeof c === 'string' ? { Code: c } : c)),
  });
