import { seedProducts, seedVariants } from './coffees';

describe('coffee seed', () => {
  it('has 6 products with 2 sizes each', () => {
    expect(seedProducts).toHaveLength(6);
    for (const product of seedProducts) {
      const sizes = seedVariants
        .filter((v) => v.productId === product.id)
        .map((v) => v.sizeGrams)
        .sort();
      expect(sizes).toEqual([250, 500]);
    }
  });

  it('has unique ids', () => {
    const ids = [...seedProducts.map((p) => p.id), ...seedVariants.map((v) => v.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('prices 250 g between 30.000 and 40.000 COP and 500 g between 55.000 and 70.000 COP', () => {
    for (const v of seedVariants) {
      const cop = v.price.amountInCents / 100;
      const [min, max] = v.sizeGrams === 250 ? [30_000, 40_000] : [55_000, 70_000];
      expect(cop).toBeGreaterThanOrEqual(min);
      expect(cop).toBeLessThanOrEqual(max);
    }
  });

  it('has stock in every variant', () => {
    expect(seedVariants.every((v) => v.stock >= 1)).toBe(true);
  });

  it('has a name, a description and an image path for each product', () => {
    for (const p of seedProducts) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
      expect(p.imageUrl).toMatch(/^\/images\/coffees\/[a-z-]+\.webp$/);
    }
  });
});
