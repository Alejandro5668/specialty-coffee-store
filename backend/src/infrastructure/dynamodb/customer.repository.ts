import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Customer } from '../../domain/customer/customer';
import { CustomerRepository } from '../../application/ports/customer.repository';
import { DynamoConfig } from './config';

const key = (email: string): string => email.trim().toLowerCase();

export class DynamoCustomerRepository implements CustomerRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly config: DynamoConfig,
  ) {}

  async findByEmail(email: string): Promise<Customer | null> {
    const { Item } = await this.client.send(
      new GetCommand({ TableName: this.config.tables.customers, Key: { email: key(email) } }),
    );
    return Item
      ? { id: String(Item.id), name: String(Item.name), email: String(Item.email) }
      : null;
  }

  async save(customer: Customer): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.config.tables.customers,
        Item: { email: key(customer.email), id: customer.id, name: customer.name },
      }),
    );
  }
}
