import { Product } from '../../src/domain/product/product';
import { release, reserve, Variant } from '../../src/domain/product/variant';
import { err, ok, Result } from '../../src/domain/shared/result';
import {
  CatalogEntry,
  CatalogRepository,
  StockError,
} from '../../src/application/ports/catalog.repository';

export class InMemoryCatalog implements CatalogRepository {
  private readonly variants = new Map<string, Variant>();

  constructor(
    private readonly products: Product[],
    variants: Variant[],
  ) {
    variants.forEach((v) => this.variants.set(v.id, v));
  }

  async listCatalog(): Promise<CatalogEntry[]> {
    return this.products.map((product) => ({
      product,
      variants: [...this.variants.values()].filter((v) => v.productId === product.id),
    }));
  }

  async findVariant(id: string): Promise<Variant | null> {
    return this.variants.get(id) ?? null;
  }

  async reserveStock(variantId: string, quantity: number): Promise<Result<Variant, StockError>> {
    return this.reserveNow(variantId, quantity);
  }

  reserveNow(variantId: string, quantity: number): Result<Variant, StockError> {
    const current = this.variants.get(variantId);
    if (!current) return err('VARIANT_NOT_FOUND');
    const reserved = reserve(current, quantity);
    if (!reserved.ok) return err('INSUFFICIENT_STOCK');
    this.variants.set(variantId, reserved.value);
    return ok(reserved.value);
  }

  async releaseStock(variantId: string, quantity: number): Promise<void> {
    this.releaseNow(variantId, quantity);
  }

  releaseNow(variantId: string, quantity: number): void {
    const current = this.variants.get(variantId);
    const released = current ? release(current, quantity) : null;
    if (released?.ok) this.variants.set(variantId, released.value);
  }

  stockOf(variantId: string): number {
    return this.variants.get(variantId)?.stock ?? -1;
  }
}
