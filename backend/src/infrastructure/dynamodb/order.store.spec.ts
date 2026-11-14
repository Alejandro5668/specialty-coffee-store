import {
  AttributeValue,
  ConditionalCheckFailedException,
  DynamoDBClient,
  TransactionCanceledException,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { Transaction } from '../../domain/transaction/transaction';
import { loadDynamoConfig } from './config';
import { DynamoOrderStore } from './order.store';
import { DynamoTransactionRepository } from './transaction.repository';

const config = loadDynamoConfig({});
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: config.region }));
const ddb = mockClient(client);
const store = () =>
  new DynamoOrderStore(client, config, new DynamoTransactionRepository(client, config));

const cop = (amountInCents: number) => ({ amountInCents, currency: 'COP' as const });
const tx = (over: Partial<Transaction> = {}): Transaction => ({
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

const canceled = (
  ...codes: Array<string | { Code: string; Item?: Record<string, AttributeValue> }>
) =>
  new TransactionCanceledException({
    message: 'Transaction cancelled',
    $metadata: {},
    CancellationReasons: codes.map((c) => (typeof c === 'string' ? { Code: c } : c)),
  });

const storedItem = {
  id: 't1',
  status: 'PENDING',
  customerId: 'c1',
  variantId: 'huila-washed-250',
  quantity: 2,
  productAmountCents: 6_400_000,
  baseFeeCents: 300_000,
  deliveryFeeCents: 800_000,
  totalCents: 7_500_000,
  delivery: { recipientName: 'Ana', address: 'Calle 1', city: 'Cali', phone: '3001234567' },
  providerRef: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => ddb.reset());

describe('DynamoOrderStore.place', () => {
  it('writes the key marker, the stock decrement and the transaction in one transaction', async () => {
    ddb.on(TransactWriteCommand).resolves({});
    const result = await store().place('key-0001-aaaa', tx());

    expect(result).toEqual({ ok: true, value: { transaction: tx(), created: true } });
    const [marker, stock, order] =
      ddb.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems!;
    expect(marker.Put).toMatchObject({
      TableName: config.tables.transactions,
      Item: { id: 'IDEM#key-0001-aaaa', transactionId: 't1' },
      ConditionExpression: 'attribute_not_exists(id)',
    });
    expect(stock.Update).toMatchObject({
      TableName: config.tables.variants,
      Key: { id: 'huila-washed-250' },
      UpdateExpression: 'SET stock = stock - :q',
      ConditionExpression: 'attribute_exists(id) AND stock >= :q',
      ExpressionAttributeValues: { ':q': 2 },
      ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
    });
    expect(order.Put).toMatchObject({
      TableName: config.tables.transactions,
      Item: { id: 't1', status: 'PENDING', totalCents: 7_500_000, quantity: 2 },
      ConditionExpression: 'attribute_not_exists(id)',
    });
  });

  it('returns the stored order untouched when the key already exists, whatever the stock is', async () => {
    ddb
      .on(TransactWriteCommand)
      .rejects(canceled('ConditionalCheckFailed', 'ConditionalCheckFailed', 'None'));
    ddb
      .on(GetCommand, { Key: { id: 'IDEM#key-0001-aaaa' } })
      .resolves({ Item: { id: 'IDEM#key-0001-aaaa', transactionId: 't1' } });
    ddb.on(GetCommand, { Key: { id: 't1' } }).resolves({ Item: storedItem });

    const result = await store().place('key-0001-aaaa', tx({ id: 't2' }));
    expect(result).toMatchObject({
      ok: true,
      value: { created: false, transaction: { id: 't1' } },
    });
  });

  it('reports INSUFFICIENT_STOCK when the variant exists but has too few units', async () => {
    ddb
      .on(TransactWriteCommand)
      .rejects(
        canceled(
          'None',
          { Code: 'ConditionalCheckFailed', Item: { id: { S: 'huila-washed-250' } } },
          'None',
        ),
      );
    expect(await store().place('key-0001-aaaa', tx())).toEqual({
      ok: false,
      error: 'INSUFFICIENT_STOCK',
    });
  });

  it('reports VARIANT_NOT_FOUND when the variant does not exist', async () => {
    ddb.on(TransactWriteCommand).rejects(canceled('None', 'ConditionalCheckFailed', 'None'));
    expect(await store().place('key-0001-aaaa', tx())).toEqual({
      ok: false,
      error: 'VARIANT_NOT_FOUND',
    });
  });

  it('rethrows conflicts and throttling so the caller can retry the same key', async () => {
    ddb.on(TransactWriteCommand).rejects(canceled('TransactionConflict', 'None', 'None'));
    await expect(store().place('key-0001-aaaa', tx())).rejects.toThrow('Transaction cancelled');
  });

  it('rethrows unexpected errors', async () => {
    ddb.on(TransactWriteCommand).rejects(new Error('boom'));
    await expect(store().place('key-0001-aaaa', tx())).rejects.toThrow('boom');
  });
});

describe('DynamoOrderStore.settle', () => {
  it('approves with a single conditional update and keeps the stock sold', async () => {
    ddb.on(UpdateCommand).resolves({});
    expect(await store().settle(tx({ status: 'APPROVED', providerRef: 'p1' }))).toBe(true);
    expect(ddb.commandCalls(TransactWriteCommand)).toHaveLength(0);
    expect(ddb.commandCalls(UpdateCommand)[0].args[0].input).toMatchObject({
      TableName: config.tables.transactions,
      Key: { id: 't1' },
      ConditionExpression: '#s = :pending',
      ExpressionAttributeValues: { ':s': 'APPROVED', ':p': 'p1', ':pending': 'PENDING' },
    });
  });

  it('answers false when the transaction was no longer PENDING', async () => {
    ddb
      .on(UpdateCommand)
      .rejects(new ConditionalCheckFailedException({ message: 'x', $metadata: {} }));
    expect(await store().settle(tx({ status: 'APPROVED', providerRef: 'p1' }))).toBe(false);
  });

  it.each(['DECLINED', 'ERROR'] as const)(
    'settles %s and gives the stock back in one transaction',
    async (status) => {
      ddb.on(TransactWriteCommand).resolves({});
      expect(await store().settle(tx({ status, providerRef: null }))).toBe(true);
      const [order, stock] = ddb.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems!;
      expect(order.Update).toMatchObject({
        TableName: config.tables.transactions,
        ConditionExpression: '#s = :pending',
        ExpressionAttributeValues: { ':s': status, ':p': null, ':pending': 'PENDING' },
      });
      expect(stock.Update).toMatchObject({
        TableName: config.tables.variants,
        Key: { id: 'huila-washed-250' },
        UpdateExpression: 'SET stock = stock + :q',
        ConditionExpression: 'attribute_exists(id)',
        ExpressionAttributeValues: { ':q': 2 },
      });
    },
  );

  it('answers false and returns nothing twice when the transaction was already settled', async () => {
    ddb.on(TransactWriteCommand).rejects(canceled('ConditionalCheckFailed', 'None'));
    expect(await store().settle(tx({ status: 'DECLINED' }))).toBe(false);
  });

  it('rethrows other cancellations instead of pretending the stock was released', async () => {
    ddb.on(TransactWriteCommand).rejects(canceled('None', 'ConditionalCheckFailed'));
    await expect(store().settle(tx({ status: 'DECLINED' }))).rejects.toThrow(
      'Transaction cancelled',
    );
  });
});
