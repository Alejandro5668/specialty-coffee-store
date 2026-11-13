import { money } from '../../domain/shared/money';
import { Product } from '../../domain/product/product';
import { createVariant, Variant } from '../../domain/product/variant';

type Row = {
  slug: string;
  name: string;
  description: string;
  cop250: number;
  cop500: number;
  stock250: number;
  stock500: number;
};

const rows: Row[] = [
  {
    slug: 'huila-washed',
    name: 'Huila Washed',
    description: 'Caramel, red apple and a clean, sweet finish.',
    cop250: 32_000,
    cop500: 58_000,
    stock250: 20,
    stock500: 12,
  },
  {
    slug: 'narino-honey',
    name: 'Nariño Honey',
    description: 'Honey, orange blossom and soft acidity.',
    cop250: 34_000,
    cop500: 62_000,
    stock250: 15,
    stock500: 10,
  },
  {
    slug: 'cauca-natural',
    name: 'Cauca Natural',
    description: 'Ripe berries, cocoa and a juicy body.',
    cop250: 36_000,
    cop500: 65_000,
    stock250: 12,
    stock500: 8,
  },
  {
    slug: 'sierra-nevada',
    name: 'Sierra Nevada',
    description: 'Milk chocolate, almond and balanced sweetness.',
    cop250: 31_000,
    cop500: 56_000,
    stock250: 25,
    stock500: 15,
  },
  {
    slug: 'tolima-anaerobic',
    name: 'Tolima Anaerobic',
    description: 'Tropical fruit, panela and a long aftertaste.',
    cop250: 39_000,
    cop500: 69_000,
    stock250: 8,
    stock500: 5,
  },
  {
    slug: 'antioquia-decaf',
    name: 'Antioquia Decaf',
    description: 'Toasted hazelnut, brown sugar and a smooth cup.',
    cop250: 33_000,
    cop500: 59_000,
    stock250: 18,
    stock500: 10,
  },
];

const variantOf = (row: Row, sizeGrams: 250 | 500): Variant => {
  const cop = sizeGrams === 250 ? row.cop250 : row.cop500;
  const price = money(cop * 100);
  if (!price.ok) throw new Error(`Invalid seed price for ${row.slug}`);
  const stock = sizeGrams === 250 ? row.stock250 : row.stock500;
  const variant = createVariant({
    id: `${row.slug}-${sizeGrams}`,
    productId: row.slug,
    sizeGrams,
    price: price.value,
    stock,
  });
  if (!variant.ok) throw new Error(`Invalid seed variant for ${row.slug}: ${variant.error}`);
  return variant.value;
};

export const seedProducts: Product[] = rows.map((r) => ({
  id: r.slug,
  name: r.name,
  description: r.description,
  imageUrl: `/images/coffees/${r.slug}.webp`,
}));

export const seedVariants: Variant[] = rows.flatMap((r) => [variantOf(r, 250), variantOf(r, 500)]);
