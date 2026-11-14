import { Product } from '../../domain/product/product';
import { createVariant, Variant } from '../../domain/product/variant';
import { money } from '../../domain/shared/money';

type Item = Record<string, unknown>;

export const toProduct = (item: Item): Product => ({
  id: String(item.id),
  name: String(item.name),
  description: String(item.description),
  imageUrl: String(item.imageUrl),
});

/** Stored data is trusted but never blindly: a corrupt price or stock must not reach a customer. */
export const toVariant = (item: Item): Variant => {
  const price = money(item.priceInCents as number);
  if (!price.ok) throw new Error(`Corrupt variant ${String(item.id)}: invalid price`);
  const variant = createVariant({
    id: String(item.id),
    productId: String(item.productId),
    sizeGrams: item.sizeGrams as Variant['sizeGrams'],
    price: price.value,
    stock: item.stock as number,
  });
  if (!variant.ok) throw new Error(`Corrupt variant ${String(item.id)}: ${variant.error}`);
  return variant.value;
};

export const fromVariant = (variant: Variant): Item => ({
  id: variant.id,
  productId: variant.productId,
  sizeGrams: variant.sizeGrams,
  priceInCents: variant.price.amountInCents,
  stock: variant.stock,
});
