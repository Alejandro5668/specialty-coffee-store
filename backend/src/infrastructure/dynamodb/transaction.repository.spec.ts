import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { loadDynamoConfig } from './config';
import { DynamoTransactionRepository } from './transaction.repository';

const config = loadDynamoConfig({});
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: config.region }));
const ddb = mockClient(client);
const repo = () => new DynamoTransactionRepository(client, config);

const item = (over: Record<string, unknown> = {}) => ({
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
  ...over,
});

beforeEach(() => ddb.reset());

describe('DynamoTransactionRepository.findById', () => {
  it('maps the stored item and reads consistently', async () => {
    ddb.on(GetCommand).resolves({ Item: item() });
    const tx = await repo().findById('t1');
    expect(tx).toMatchObject({
      id: 't1',
      status: 'PENDING',
      quantity: 2,
      providerRef: null,
      amounts: {
        productAmount: { amountInCents: 6_400_000, currency: 'COP' },
        baseFee: { amountInCents: 300_000 },
        deliveryFee: { amountInCents: 800_000 },
        total: { amountInCents: 7_500_000 },
      },
      delivery: { city: 'Cali' },
    });
    expect(ddb.commandCalls(GetCommand)[0].args[0].input).toMatchObject({
      TableName: config.tables.transactions,
      Key: { id: 't1' },
      ConsistentRead: true,
    });
  });

  it('returns null when it does not exist', async () => {
    ddb.on(GetCommand).resolves({});
    expect(await repo().findById('nope')).toBeNull();
  });

  it.each(['', 'IDEM#abc', 42])(
    'never reads for the id %p (idempotency markers are not transactions)',
    async (id) => {
      expect(await repo().findById(id as string)).toBeNull();
      expect(ddb.commandCalls(GetCommand)).toHaveLength(0);
    },
  );

  it('fails loudly on a corrupt status', async () => {
    ddb.on(GetCommand).resolves({ Item: item({ status: 'WEIRD' }) });
    await expect(repo().findById('t1')).rejects.toThrow('Corrupt transaction');
  });

  it('fails loudly on a corrupt amount', async () => {
    ddb.on(GetCommand).resolves({ Item: item({ totalCents: -1 }) });
    await expect(repo().findById('t1')).rejects.toThrow('Corrupt transaction');
  });
});

describe('DynamoTransactionRepository.findByIdempotencyKey', () => {
  it('follows the marker to the transaction', async () => {
    ddb
      .on(GetCommand, { Key: { id: 'IDEM#key-0001-aaaa' } })
      .resolves({ Item: { id: 'IDEM#key-0001-aaaa', transactionId: 't1' } });
    ddb
      .on(GetCommand, { Key: { id: 't1' } })
      .resolves({ Item: item({ status: 'APPROVED', providerRef: 'p1' }) });
    expect(await repo().findByIdempotencyKey('key-0001-aaaa')).toMatchObject({
      id: 't1',
      status: 'APPROVED',
      providerRef: 'p1',
    });
  });

  it('returns null when there is no marker', async () => {
    ddb.on(GetCommand).resolves({});
    expect(await repo().findByIdempotencyKey('key-0001-aaaa')).toBeNull();
  });
});
