import { createDocumentClient, loadDynamoConfig } from './config';

describe('loadDynamoConfig', () => {
  it('defaults to us-east-2 and the coffee-store table names', () => {
    expect(loadDynamoConfig({})).toEqual({
      region: 'us-east-2',
      tables: {
        products: 'coffee-store-products',
        variants: 'coffee-store-variants',
        customers: 'coffee-store-customers',
        transactions: 'coffee-store-transactions',
      },
    });
  });

  it('uses the table prefix and the region from the environment', () => {
    const config = loadDynamoConfig({ AWS_REGION: 'us-east-2', TABLE_PREFIX: 'shop' });
    expect(config.tables.transactions).toBe('shop-transactions');
  });

  it.each(['', '  ', 'has space', 'a'.repeat(200)])('rejects the table prefix %p', (prefix) => {
    expect(() => loadDynamoConfig({ TABLE_PREFIX: prefix })).toThrow('TABLE_PREFIX');
  });
});

describe('createDocumentClient', () => {
  it('builds a document client for the configured region', async () => {
    const client = createDocumentClient(loadDynamoConfig({}));
    expect(await client.config.region()).toBe('us-east-2');
  });
});
