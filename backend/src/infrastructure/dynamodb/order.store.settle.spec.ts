import { TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, config, store, tx, canceled } from '../../../test/order-store-kit';

beforeEach(() => ddb.reset());

describe('DynamoOrderStore.settle', () => {
  it('approves and assigns the delivery in one transaction, keeping the stock sold', async () => {
    ddb.on(TransactWriteCommand).resolves({});
    expect(await store().settle(tx({ status: 'APPROVED', providerRef: 'p1' }))).toBe(true);
    expect(ddb.commandCalls(UpdateCommand)).toHaveLength(0);
    const [order, delivery] =
      ddb.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems!;
    expect(order.Update).toMatchObject({
      TableName: config.tables.transactions,
      Key: { id: 't1' },
      ConditionExpression: '#s = :pending',
      ExpressionAttributeValues: { ':s': 'APPROVED', ':p': 'p1', ':pending': 'PENDING' },
    });
    expect(delivery.Put).toEqual({
      TableName: config.tables.deliveries,
      ConditionExpression: 'attribute_not_exists(id)',
      Item: {
        id: 't1',
        customerId: 'c1',
        variantId: 'huila-washed-250',
        quantity: 2,
        recipientName: 'Ana',
        address: 'Calle 1',
        city: 'Cali',
        phone: '3001234567',
        status: 'ASSIGNED',
      },
    });
  });

  it('never stores a delivery for a payment that was not approved', async () => {
    ddb.on(TransactWriteCommand).resolves({});
    await store().settle(tx({ status: 'DECLINED' }));
    const items = ddb.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems!;
    expect(items.some((item) => item.Put)).toBe(false);
  });

  it('answers false, with no delivery, when the transaction was no longer PENDING', async () => {
    ddb.on(TransactWriteCommand).rejects(canceled('ConditionalCheckFailed', 'None'));
    expect(await store().settle(tx({ status: 'APPROVED', providerRef: 'p1' }))).toBe(false);
  });

  it('rethrows when the delivery could not be stored, so the order is never approved without it', async () => {
    ddb.on(TransactWriteCommand).rejects(canceled('None', 'ConditionalCheckFailed'));
    await expect(store().settle(tx({ status: 'APPROVED' }))).rejects.toThrow(
      'Transaction cancelled',
    );
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
