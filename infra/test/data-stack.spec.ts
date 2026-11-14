import { build } from './stacks';

const { data } = build();

describe('DataStack', () => {
  it.each([
    ['products', 'id'],
    ['variants', 'id'],
    ['transactions', 'id'],
    ['deliveries', 'id'],
    ['customers', 'email'],
  ])('creates coffee-store-%s keyed by %s', (name, key) => {
    data.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: `coffee-store-${name}`,
      KeySchema: [{ AttributeName: key, KeyType: 'HASH' }],
    });
  });

  it('creates exactly five tables, on demand, so an idle store costs nothing', () => {
    data.resourceCountIs('AWS::DynamoDB::Table', 5);
    for (const table of Object.values(data.findResources('AWS::DynamoDB::Table'))) {
      expect(table.Properties.BillingMode).toBe('PAY_PER_REQUEST');
    }
  });

  it('keeps point-in-time recovery on the orders, the data that cannot be rebuilt', () => {
    data.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'coffee-store-transactions',
      PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
    });
  });

  it('keeps point-in-time recovery on the deliveries too: they say what to ship and to whom', () => {
    data.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'coffee-store-deliveries',
      PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
    });
  });

  it('can be destroyed with the stack, so the cleanup leaves nothing billing', () => {
    for (const table of Object.values(data.findResources('AWS::DynamoDB::Table'))) {
      expect(table.DeletionPolicy).toBe('Delete');
    }
  });

  it('tags every table with the project, so the whole project can be found in one view', () => {
    for (const table of Object.values(data.findResources('AWS::DynamoDB::Table'))) {
      expect(table.Properties.Tags).toEqual(
        expect.arrayContaining([{ Key: 'Project', Value: 'coffee-store' }]),
      );
    }
  });
});
