/** What the API sends, as described in docs/openapi.json. */
export type VariantView = {
  id: string;
  sizeGrams: 250 | 500;
  priceInCents: number;
  currency: 'COP';
  stock: number;
};

export type ProductView = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  variants: VariantView[];
};
