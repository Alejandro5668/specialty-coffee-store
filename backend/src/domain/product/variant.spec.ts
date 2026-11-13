import { err, ok } from '../shared/result';
import { money } from '../shared/money';
import { createVariant, release, reserve, Variant } from './variant';

const price = (() => {
  const m = money(35_000_00);
  if (!m.ok) throw new Error('setup');
  return m.value;
})();

const variant = (stock: number): Variant => {
  const v = createVariant({ id: 'v1', productId: 'p1', sizeGrams: 250, price, stock });
  if (!v.ok) throw new Error('setup');
  return v.value;
};

describe('createVariant', () => {
  it('creates a variant with its size, price and stock', () => {
    expect(variant(5)).toEqual({ id: 'v1', productId: 'p1', sizeGrams: 250, price, stock: 5 });
  });

  it.each([-1, 1.5, NaN])('rejects stock %p', (stock) => {
    expect(createVariant({ id: 'v1', productId: 'p1', sizeGrams: 250, price, stock })).toEqual(
      err('INVALID_STOCK'),
    );
  });

  it('rejects a size that is not sold', () => {
    const result = createVariant({
      id: 'v1',
      productId: 'p1',
      sizeGrams: 300 as 250,
      price,
      stock: 1,
    });
    expect(result).toEqual(err('INVALID_SIZE'));
  });
});

describe('reserve', () => {
  it('decreases stock by the quantity', () => {
    expect(reserve(variant(5), 2)).toEqual(ok({ ...variant(5), stock: 3 }));
  });

  it('allows taking the last unit', () => {
    expect(reserve(variant(1), 1)).toEqual(ok({ ...variant(1), stock: 0 }));
  });

  it('rejects more than the available stock and never goes negative', () => {
    expect(reserve(variant(1), 2)).toEqual(err('INSUFFICIENT_STOCK'));
  });

  it.each([0, -1, 1.5, NaN])('rejects quantity %p', (quantity) => {
    expect(reserve(variant(5), quantity)).toEqual(err('INVALID_QUANTITY'));
  });
});

describe('release', () => {
  it('gives the units back', () => {
    expect(release(variant(3), 2)).toEqual(ok({ ...variant(3), stock: 5 }));
  });

  it.each([0, -1, 1.5])('rejects quantity %p', (quantity) => {
    expect(release(variant(3), quantity)).toEqual(err('INVALID_QUANTITY'));
  });
});
