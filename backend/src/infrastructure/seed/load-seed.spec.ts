import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { loadDynamoConfig } from '../dynamodb/config';
import { loadSeed } from './load-seed';

const config = loadDynamoConfig({});
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: config.region }));
const ddb = mockClient(client);

beforeEach(() => ddb.reset());

const puts = () => ddb.commandCalls(PutCommand).map((c) => c.args[0].input);

describe('loadSeed', () => {
  it('writes 6 products and 12 variants', async () => {
    ddb.on(PutCommand).resolves({});
    const summary = await loadSeed(client, config);
    expect(summary).toEqual({ written: 18, skipped: 0 });
    expect(puts().filter((p) => p.TableName === config.tables.products)).toHaveLength(6);
    expect(puts().filter((p) => p.TableName === config.tables.variants)).toHaveLength(12);
  });

  it('never overwrites an existing item, so a second run keeps the live stock', async () => {
    ddb.on(PutCommand).resolves({});
    await loadSeed(client, config);
    expect(puts().every((p) => p.ConditionExpression === 'attribute_not_exists(id)')).toBe(true);
  });

  it('stores variants with the price in cents and the stock', async () => {
    ddb.on(PutCommand).resolves({});
    await loadSeed(client, config);
    const huila = puts().find((p) => p.Item?.id === 'huila-washed-250');
    expect(huila).toMatchObject({
      TableName: config.tables.variants,
      Item: { productId: 'huila-washed', sizeGrams: 250, priceInCents: 3_200_000, stock: 20 },
    });
  });

  it('counts the items that already existed as skipped', async () => {
    ddb
      .on(PutCommand)
      .resolves({})
      .on(PutCommand, { TableName: config.tables.products })
      .rejects(new ConditionalCheckFailedException({ message: 'exists', $metadata: {} }));
    expect(await loadSeed(client, config)).toEqual({ written: 12, skipped: 6 });
  });

  it('fails on any other error instead of reporting a partial load as done', async () => {
    ddb.on(PutCommand).rejects(new Error('AccessDeniedException'));
    await expect(loadSeed(client, config)).rejects.toThrow('AccessDeniedException');
  });
});
