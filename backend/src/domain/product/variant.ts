import { Money } from '../shared/money';
import { err, ok, Result } from '../shared/result';

export const SIZES_IN_GRAMS = [250, 500] as const;
export type SizeInGrams = (typeof SIZES_IN_GRAMS)[number];

export type Variant = {
  readonly id: string;
  readonly productId: string;
  readonly sizeGrams: SizeInGrams;
  readonly price: Money;
  readonly stock: number;
};

export type VariantError =
  'INVALID_STOCK' | 'INVALID_SIZE' | 'INVALID_QUANTITY' | 'INSUFFICIENT_STOCK';

const isPositiveInt = (n: number): boolean => Number.isSafeInteger(n) && n >= 1;

export const createVariant = (input: Variant): Result<Variant, VariantError> => {
  if (!SIZES_IN_GRAMS.includes(input.sizeGrams)) return err('INVALID_SIZE');
  if (!Number.isSafeInteger(input.stock) || input.stock < 0) return err('INVALID_STOCK');
  return ok({ ...input });
};

export const reserve = (variant: Variant, quantity: number): Result<Variant, VariantError> => {
  if (!isPositiveInt(quantity)) return err('INVALID_QUANTITY');
  if (quantity > variant.stock) return err('INSUFFICIENT_STOCK');
  return ok({ ...variant, stock: variant.stock - quantity });
};

export const release = (variant: Variant, quantity: number): Result<Variant, VariantError> =>
  isPositiveInt(quantity)
    ? ok({ ...variant, stock: variant.stock + quantity })
    : err('INVALID_QUANTITY');
