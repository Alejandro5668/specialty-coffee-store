import { ok, Result } from '../../domain/shared/result';
import { CatalogRepository } from '../ports/catalog.repository';

export type VariantView = {
  id: string;
  sizeGrams: number;
  priceInCents: number;
  currency: 'COP';
  stock: number;
};
export type ProductView = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  variants: VariantView[];
};

export class ListProducts {
  constructor(private readonly catalog: CatalogRepository) {}

  async execute(): Promise<Result<ProductView[], never>> {
    const entries = await this.catalog.listCatalog();
    return ok(
      entries.map(({ product, variants }) => ({
        ...product,
        variants: [...variants]
          .sort((a, b) => a.sizeGrams - b.sizeGrams)
          .map((v) => ({
            id: v.id,
            sizeGrams: v.sizeGrams,
            priceInCents: v.price.amountInCents,
            currency: v.price.currency,
            stock: v.stock,
          })),
      })),
    );
  }
}
