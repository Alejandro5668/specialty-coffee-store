import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export type DynamoConfig = {
  region: string;
  tables: { products: string; variants: string; customers: string; transactions: string };
};

const PREFIX = /^[A-Za-z0-9_.-]{1,100}$/;

export const loadDynamoConfig = (env: Record<string, string | undefined>): DynamoConfig => {
  const prefix = env.TABLE_PREFIX ?? 'coffee-store';
  if (!PREFIX.test(prefix)) throw new Error('TABLE_PREFIX is not a valid table name prefix');
  return {
    region: env.AWS_REGION ?? 'us-east-2',
    tables: {
      products: `${prefix}-products`,
      variants: `${prefix}-variants`,
      customers: `${prefix}-customers`,
      transactions: `${prefix}-transactions`,
    },
  };
};

export const createDocumentClient = (config: DynamoConfig): DynamoDBDocumentClient =>
  DynamoDBDocumentClient.from(new DynamoDBClient({ region: config.region }), {
    marshallOptions: { removeUndefinedValues: true },
  });
