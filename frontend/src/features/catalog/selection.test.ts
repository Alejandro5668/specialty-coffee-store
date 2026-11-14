import { ProductView } from '../../api/types';
import { initialSelection, safeQuantity } from './selection';
import { MAX_PER_ORDER } from '../../lib/limits';

const variant = (id: string, size: 250 | 500, stock: number) => ({
  id,
  sizeGrams: size,
  priceInCents: 100,
  currency: 'COP' as const,
  stock,
});
const product = (stocks: [number, number]): ProductView => ({
  id: 'a',
  name: 'A',
  description: '',
  imageUrl: '/i.webp',
  variants: [variant('a-250', 250, stocks[0]), variant('a-500', 500, stocks[1])],
});

describe('initialSelection', () => {
  it('starts on the smallest size that is in stock', () => {
    expect(initialSelection(product([3, 3]), null)).toEqual({ variantId: 'a-250', quantity: 1 });
    expect(initialSelection(product([0, 3]), null)).toEqual({ variantId: 'a-500', quantity: 1 });
  });

  it('falls back to the first size when nothing is in stock', () => {
    expect(initialSelection(product([0, 0]), null)).toEqual({ variantId: 'a-250', quantity: 1 });
  });

  it('restores the saved selection of this coffee', () => {
    expect(initialSelection(product([5, 5]), { variantId: 'a-500', quantity: 3 })).toEqual({
      variantId: 'a-500',
      quantity: 3,
    });
  });

  it('keeps the saved size but caps the quantity to what is in stock now', () => {
    expect(initialSelection(product([5, 2]), { variantId: 'a-500', quantity: 7 })).toEqual({
      variantId: 'a-500',
      quantity: 2,
    });
  });

  it.each([
    ['another coffee', { variantId: 'b-250', quantity: 2 }],
    ['a size that is agotado now', { variantId: 'a-500', quantity: 2 }],
    ['nothing', { variantId: null, quantity: 1 }],
  ])('ignores a saved selection of %s', (_label, saved) => {
    expect(initialSelection(product([5, 0]), saved)).toEqual({ variantId: 'a-250', quantity: 1 });
  });
});

describe('safeQuantity', () => {
  it('never exceeds the stock or the order limit, and is at least one', () => {
    expect(safeQuantity(3, 10)).toBe(3);
    expect(safeQuantity(9, 4)).toBe(4);
    expect(safeQuantity(50, 99)).toBe(MAX_PER_ORDER);
    expect(safeQuantity(0, 5)).toBe(1);
    expect(safeQuantity(2, 0)).toBe(1);
  });
});
