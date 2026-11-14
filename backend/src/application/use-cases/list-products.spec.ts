import { catalogWithStock, VARIANT_ID } from '../../../test/fakes/fixtures';
import { ListProducts } from './list-products';

describe('ListProducts', () => {
  it('returns every product with its variants, price and stock', async () => {
    const result = await new ListProducts(catalogWithStock(VARIANT_ID, 7)).execute();
    if (!result.ok) throw new Error('expected ok');

    expect(result.value).toHaveLength(6);
    const huila = result.value.find((p) => p.id === 'huila-washed')!;
    expect(huila).toMatchObject({
      name: 'Huila Washed',
      imageUrl: '/images/coffees/huila-washed.webp',
    });
    expect(huila.variants).toEqual([
      {
        id: 'huila-washed-250',
        sizeGrams: 250,
        priceInCents: 3_200_000,
        currency: 'COP',
        stock: 7,
      },
      {
        id: 'huila-washed-500',
        sizeGrams: 500,
        priceInCents: 5_800_000,
        currency: 'COP',
        stock: 12,
      },
    ]);
  });

  it('orders variants by size', async () => {
    const result = await new ListProducts(catalogWithStock(VARIANT_ID, 1)).execute();
    if (!result.ok) throw new Error('expected ok');
    for (const product of result.value) {
      expect(product.variants.map((v) => v.sizeGrams)).toEqual([250, 500]);
    }
  });

  it('shows the updated stock after a reservation', async () => {
    const catalog = catalogWithStock(VARIANT_ID, 3);
    await catalog.reserveStock(VARIANT_ID, 2);
    const result = await new ListProducts(catalog).execute();
    if (!result.ok) throw new Error('expected ok');
    const variant = result.value.flatMap((p) => p.variants).find((v) => v.id === VARIANT_ID);
    expect(variant?.stock).toBe(1);
  });
});
