import { Clock, IdGenerator } from '../../src/application/ports/system.ports';
import { seedProducts, seedVariants } from '../../src/infrastructure/seed/coffees';
import { InMemoryCatalog } from './in-memory-catalog';

export const fixedClock: Clock = { now: () => '2026-01-01T00:00:00.000Z' };

export const sequentialIds = (): IdGenerator => {
  let n = 0;
  return { next: () => `id-${++n}` };
};

/** A catalog with the seed data, but with a chosen stock for one variant. */
export const catalogWithStock = (variantId: string, stock: number): InMemoryCatalog =>
  new InMemoryCatalog(
    seedProducts,
    seedVariants.map((v) => (v.id === variantId ? { ...v, stock } : v)),
  );

export const VARIANT_ID = 'huila-washed-250';
