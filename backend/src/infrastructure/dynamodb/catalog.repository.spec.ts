import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { loadDynamoConfig } from './config';
import { DynamoCatalogRepository } from './catalog.repository';

const config = loadDynamoConfig({});
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: config.region }));
const ddb = mockClient(client);
const repo = () => new DynamoCatalogRepository(client, config);

const productItem = (id: string) => ({
  id,
  name: `Name ${id}`,
  description: 'Sweet',
  imageUrl: `/images/coffees/${id}.webp`,
});
const variantItem = (id: string, productId: string, over: Record<string, unknown> = {}) => ({
  id,
  productId,
  sizeGrams: 250,
  priceInCents: 3_200_000,
  stock: 4,
  ...over,
});

beforeEach(() => ddb.reset());

describe('DynamoCatalogRepository.listCatalog', () => {
  it('joins products with their variants and reads consistently', async () => {
    ddb
      .on(ScanCommand, { TableName: config.tables.products })
      .resolves({ Items: [productItem('a'), productItem('b')] });
    ddb.on(ScanCommand, { TableName: config.tables.variants }).resolves({
      Items: [
        variantItem('a-250', 'a'),
        variantItem('b-250', 'b'),
        variantItem('b-500', 'b', { sizeGrams: 500 }),
      ],
    });

    const catalog = await repo().listCatalog();

    expect(catalog.map((e) => [e.product.id, e.variants.map((v) => v.id)])).toEqual([
      ['a', ['a-250']],
      ['b', ['b-250', 'b-500']],
    ]);
    expect(catalog[0].variants[0]).toMatchObject({
      price: { amountInCents: 3_200_000, currency: 'COP' },
      stock: 4,
    });
    expect(
      ddb.commandCalls(ScanCommand).every((c) => c.args[0].input.ConsistentRead === true),
    ).toBe(true);
  });

  it('follows pagination until the table is exhausted', async () => {
    ddb
      .on(ScanCommand, { TableName: config.tables.products })
      .resolvesOnce({ Items: [productItem('a')], LastEvaluatedKey: { id: 'a' } })
      .resolvesOnce({ Items: [productItem('b')] });
    ddb.on(ScanCommand, { TableName: config.tables.variants }).resolves({ Items: [] });

    const catalog = await repo().listCatalog();
    expect(catalog.map((e) => e.product.id)).toEqual(['a', 'b']);
  });

  it('fails loudly on a corrupt variant instead of showing a wrong price', async () => {
    ddb
      .on(ScanCommand, { TableName: config.tables.products })
      .resolves({ Items: [productItem('a')] });
    ddb
      .on(ScanCommand, { TableName: config.tables.variants })
      .resolves({ Items: [variantItem('a-250', 'a', { priceInCents: -5 })] });
    await expect(repo().listCatalog()).rejects.toThrow('Corrupt variant');
  });
});

describe('DynamoCatalogRepository.findVariant', () => {
  it('returns the variant with a consistent read', async () => {
    ddb.on(GetCommand).resolves({ Item: variantItem('a-250', 'a') });
    const variant = await repo().findVariant('a-250');
    expect(variant).toMatchObject({ id: 'a-250', stock: 4, sizeGrams: 250 });
    expect(ddb.commandCalls(GetCommand)[0].args[0].input).toMatchObject({
      TableName: config.tables.variants,
      Key: { id: 'a-250' },
      ConsistentRead: true,
    });
  });

  it('returns null for an unknown id', async () => {
    ddb.on(GetCommand).resolves({});
    expect(await repo().findVariant('nope')).toBeNull();
  });

  it('never queries DynamoDB with a non-string or empty id', async () => {
    expect(await repo().findVariant('')).toBeNull();
    expect(await repo().findVariant(42 as unknown as string)).toBeNull();
    expect(ddb.commandCalls(GetCommand)).toHaveLength(0);
  });
});
