import { DynamoDBDocumentClient, GetCommand, paginateScan } from '@aws-sdk/lib-dynamodb';
import { Variant } from '../../domain/product/variant';
import { CatalogEntry, CatalogRepository } from '../../application/ports/catalog.repository';
import { DynamoConfig } from './config';
import { toProduct, toVariant } from './mappers';

export class DynamoCatalogRepository implements CatalogRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly config: DynamoConfig,
  ) {}

  /** The catalog is the seed data (a handful of items, no create endpoint), so a bounded Scan is fine. */
  async listCatalog(): Promise<CatalogEntry[]> {
    const [products, variants] = await Promise.all([
      this.scanAll(this.config.tables.products),
      this.scanAll(this.config.tables.variants),
    ]);
    const all = variants.map(toVariant);
    return products.map(toProduct).map((product) => ({
      product,
      variants: all.filter((v) => v.productId === product.id),
    }));
  }

  async findVariant(id: string): Promise<Variant | null> {
    if (typeof id !== 'string' || id === '') return null;
    const { Item } = await this.client.send(
      new GetCommand({ TableName: this.config.tables.variants, Key: { id }, ConsistentRead: true }),
    );
    return Item ? toVariant(Item) : null;
  }

  private async scanAll(table: string): Promise<Record<string, unknown>[]> {
    const items: Record<string, unknown>[] = [];
    for await (const page of paginateScan(
      { client: this.client },
      { TableName: table, ConsistentRead: true },
    )) {
      items.push(...(page.Items ?? []));
    }
    return items;
  }
}
