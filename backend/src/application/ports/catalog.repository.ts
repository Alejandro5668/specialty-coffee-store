import { Product } from '../../domain/product/product';
import { Variant } from '../../domain/product/variant';

export type CatalogEntry = { product: Product; variants: Variant[] };
export type StockError = 'VARIANT_NOT_FOUND' | 'INSUFFICIENT_STOCK';

export interface CatalogRepository {
  listCatalog(): Promise<CatalogEntry[]>;
  findVariant(id: string): Promise<Variant | null>;
}
