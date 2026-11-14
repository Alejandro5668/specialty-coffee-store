import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  createDocumentClient,
  DynamoConfig,
  loadDynamoConfig,
} from '../infrastructure/dynamodb/config';
import { loadPaymentConfig, PaymentConfig } from '../infrastructure/payments/config';

export type Runtime = {
  dynamo: DynamoConfig;
  client: DynamoDBDocumentClient;
  payments: PaymentConfig;
};

let cached: Runtime | undefined;

/** Built on first use, so a test that replaces every port never needs the environment. */
export const runtime = (): Runtime => {
  if (!cached) {
    const dynamo = loadDynamoConfig(process.env);
    cached = {
      dynamo,
      client: createDocumentClient(dynamo),
      payments: loadPaymentConfig(process.env),
    };
  }
  return cached;
};

export const resetRuntime = (): void => {
  cached = undefined;
};
