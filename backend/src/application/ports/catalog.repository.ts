import { Product } from '../../domain/product/product';
import { Variant } from '../../domain/product/variant';
import { Result } from '../../domain/shared/result';

export type CatalogEntry = { product: Product; variants: Variant[] };
export type StockError = 'VARIANT_NOT_FOUND' | 'INSUFFICIENT_STOCK';

export interface CatalogRepository {
  listCatalog(): Promise<CatalogEntry[]>;
  findVariant(id: string): Promise<Variant | null>;
  /** Must be atomic: two concurrent calls on the last unit let exactly one succeed. */
  reserveStock(variantId: string, quantity: number): Promise<Result<Variant, StockError>>;
  releaseStock(variantId: string, quantity: number): Promise<void>;
}
