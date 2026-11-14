import { ProductView } from '../../api/types';
import { MAX_PER_ORDER } from '../../lib/limits';

export type Saved = { variantId: string | null; quantity: number } | null;

/** At least one, never more than what is in stock or allowed per order. */
export const safeQuantity = (wanted: number, stock: number): number =>
  Math.max(1, Math.min(Math.floor(wanted) || 1, stock, MAX_PER_ORDER));

/**
 * Restores what the shopper chose before a refresh, but only if it still makes sense for the
 * current catalog; otherwise starts on the smallest size that is in stock.
 */
export const initialSelection = (
  product: ProductView,
  saved: Saved,
): { variantId: string; quantity: number } => {
  const kept = product.variants.find((v) => v.id === saved?.variantId && v.stock > 0);
  if (saved && kept)
    return { variantId: kept.id, quantity: safeQuantity(saved.quantity, kept.stock) };
  const first = product.variants.find((v) => v.stock > 0) ?? product.variants[0];
  return { variantId: first.id, quantity: 1 };
};
