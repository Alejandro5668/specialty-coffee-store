import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { loadDynamoConfig } from './config';
import { DynamoShipmentRepository } from './shipment.repository';

const config = loadDynamoConfig({});
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: config.region }));
const ddb = mockClient(client);
const repo = () => new DynamoShipmentRepository(client, config);

const item = {
  id: 't1',
  customerId: 'c1',
  variantId: 'huila-washed-250',
  quantity: 2,
  recipientName: 'Ana',
  address: 'Calle 1',
  city: 'Cali',
  phone: '3001234567',
  status: 'ASSIGNED',
};

beforeEach(() => ddb.reset());

describe('DynamoShipmentRepository.findById', () => {
  it('reads the delivery of an order with a consistent read', async () => {
    ddb.on(GetCommand).resolves({ Item: item });
    expect(await repo().findById('t1')).toEqual(item);
    expect(ddb.commandCalls(GetCommand)[0].args[0].input).toEqual({
      TableName: config.tables.deliveries,
      Key: { id: 't1' },
      ConsistentRead: true,
    });
  });

  it('answers null when the order has no delivery', async () => {
    ddb.on(GetCommand).resolves({});
    expect(await repo().findById('t1')).toBeNull();
  });

  it.each(['', undefined, 42, null])(
    'answers null without asking the database for %p',
    async (id) => {
      expect(await repo().findById(id as unknown as string)).toBeNull();
      expect(ddb.commandCalls(GetCommand)).toHaveLength(0);
    },
  );

  it('refuses a stored item with an unknown status instead of showing it', async () => {
    ddb.on(GetCommand).resolves({ Item: { ...item, status: 'LOST' } });
    await expect(repo().findById('t1')).rejects.toThrow('Corrupt delivery t1');
  });
});
