import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { ShipmentRepository } from '../../application/ports/shipment.repository';
import { Shipment } from '../../domain/shipment/shipment';
import { DynamoConfig } from './config';
import { toShipment } from './mappers';

export class DynamoShipmentRepository implements ShipmentRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly config: DynamoConfig,
  ) {}

  async findById(id: string): Promise<Shipment | null> {
    if (typeof id !== 'string' || id === '') return null;
    const { Item } = await this.client.send(
      new GetCommand({
        TableName: this.config.tables.deliveries,
        Key: { id },
        ConsistentRead: true,
      }),
    );
    return Item ? toShipment(Item) : null;
  }
}
