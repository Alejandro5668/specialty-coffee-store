import { RemovalPolicy, Stack, StackProps, Tags } from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export const TABLE_PREFIX = 'coffee-store';
export const PROJECT = 'coffee-store';

export type Tables = { products: Table; variants: Table; customers: Table; transactions: Table };

/** The four tables the API reads and writes. Names match `TABLE_PREFIX` in the backend. */
export class DataStack extends Stack {
  readonly tables: Tables;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    Tags.of(this).add('Project', PROJECT);
    const table = (name: string, key: string, recovery = false) =>
      new Table(this, name, {
        tableName: `${TABLE_PREFIX}-${name}`,
        partitionKey: { name: key, type: AttributeType.STRING },
        billingMode: BillingMode.PAY_PER_REQUEST,
        pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: recovery },
        removalPolicy: RemovalPolicy.DESTROY,
      });
    this.tables = {
      products: table('products', 'id'),
      variants: table('variants', 'id'),
      customers: table('customers', 'email'),
      transactions: table('transactions', 'id', true),
    };
  }
}
