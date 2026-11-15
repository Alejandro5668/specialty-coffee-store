/** Test card numbers published for the payment sandbox. They are not real cards. */
export const CARDS = {
  approved: '4242424242424242',
  declined: '4111111111111111',
  luhnFails: '4242424242424241',
} as const;

export const PERSON = {
  cardHolder: 'Ana Perez',
  name: 'Ana Perez',
  email: 'ana@example.com',
  address: 'Calle 10 # 5-20',
  city: 'Medellín',
  phone: '300 123 4567',
};

export const FEES = { baseFeeInCents: 300_000, deliveryFeeInCents: 800_000 };

export type Variant = { id: string; sizeGrams: 250 | 500; priceInCents: number; stock: number };
export type Product = { id: string; name: string; description: string; variants: Variant[] };

/** Two coffees are enough to cover every screen. Stock is changed by the tests. */
export const catalog = (): Product[] => [
  {
    id: 'huila-washed',
    name: 'Huila Lavado',
    description: 'Caramelo, manzana roja y un final limpio y dulce.',
    variants: [
      { id: 'huila-washed-250', sizeGrams: 250, priceInCents: 3_200_000, stock: 20 },
      { id: 'huila-washed-500', sizeGrams: 500, priceInCents: 5_800_000, stock: 12 },
    ],
  },
  {
    id: 'sierra-nevada',
    name: 'Sierra Nevada',
    description: 'Chocolate con leche, almendra y dulzor equilibrado.',
    variants: [
      { id: 'sierra-nevada-250', sizeGrams: 250, priceInCents: 3_000_000, stock: 0 },
      { id: 'sierra-nevada-500', sizeGrams: 500, priceInCents: 5_400_000, stock: 0 },
    ],
  },
];
