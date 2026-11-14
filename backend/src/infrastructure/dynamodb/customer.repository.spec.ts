import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { loadDynamoConfig } from './config';
import { DynamoCustomerRepository } from './customer.repository';

const config = loadDynamoConfig({});
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: config.region }));
const ddb = mockClient(client);
const repo = () => new DynamoCustomerRepository(client, config);

beforeEach(() => ddb.reset());

describe('DynamoCustomerRepository', () => {
  it('finds a customer by lower-cased email', async () => {
    ddb.on(GetCommand).resolves({ Item: { email: 'ana@example.com', id: 'c1', name: 'Ana' } });
    expect(await repo().findByEmail('Ana@Example.com')).toEqual({
      id: 'c1',
      name: 'Ana',
      email: 'ana@example.com',
    });
    expect(ddb.commandCalls(GetCommand)[0].args[0].input).toMatchObject({
      TableName: config.tables.customers,
      Key: { email: 'ana@example.com' },
    });
  });

  it('returns null when the customer does not exist', async () => {
    ddb.on(GetCommand).resolves({});
    expect(await repo().findByEmail('x@example.com')).toBeNull();
  });

  it('saves the customer keyed by lower-cased email', async () => {
    ddb.on(PutCommand).resolves({});
    await repo().save({ id: 'c1', name: 'Ana', email: 'Ana@Example.com' });
    expect(ddb.commandCalls(PutCommand)[0].args[0].input).toEqual({
      TableName: config.tables.customers,
      Item: { email: 'ana@example.com', id: 'c1', name: 'Ana' },
    });
  });
});
