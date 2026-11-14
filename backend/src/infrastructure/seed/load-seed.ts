import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoConfig } from '../dynamodb/config';
import { fromVariant } from '../dynamodb/mappers';
import { seedProducts, seedVariants } from './coffees';

export type SeedSummary = { written: number; skipped: number };

/**
 * Products hold only catalog text, so they are rewritten and an edit reaches a live store.
 * Variants hold the stock, so they are put-if-absent: running it again never resets it.
 */
export const loadSeed = async (
  client: DynamoDBDocumentClient,
  config: DynamoConfig,
): Promise<SeedSummary> => {
  const rows = [
    ...seedProducts.map((item) => ({
      table: config.tables.products,
      item: { ...item },
      onlyIfAbsent: false,
    })),
    ...seedVariants.map((v) => ({
      table: config.tables.variants,
      item: fromVariant(v),
      onlyIfAbsent: true,
    })),
  ];

  const outcomes = await Promise.all(
    rows.map(async ({ table, item, onlyIfAbsent }) => {
      try {
        await client.send(
          new PutCommand({
            TableName: table,
            Item: item,
            ...(onlyIfAbsent && { ConditionExpression: 'attribute_not_exists(id)' }),
          }),
        );
        return 'written' as const;
      } catch (error) {
        if (error instanceof ConditionalCheckFailedException) return 'skipped' as const;
        throw error;
      }
    }),
  );

  return {
    written: outcomes.filter((o) => o === 'written').length,
    skipped: outcomes.filter((o) => o === 'skipped').length,
  };
};
