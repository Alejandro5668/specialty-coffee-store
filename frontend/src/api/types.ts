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

export type CardBrand = 'visa' | 'mastercard' | 'unknown';

export type Contract = { token: string; permalink: string };

/** Terms to accept (single-use tokens) and the fees the server adds to every order. */
export type CheckoutOptions = {
  acceptance: Contract;
  personalData: Contract;
  fees: { currency: 'COP'; baseFeeInCents: number; deliveryFeeInCents: number };
  maxQuantity: number;
};

export type TransactionStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'ERROR';

export type TransactionView = {
  id: string;
  status: TransactionStatus;
  variantId: string;
  quantity: number;
  amounts: {
    currency: 'COP';
    productAmountInCents: number;
    baseFeeInCents: number;
    deliveryFeeInCents: number;
    totalInCents: number;
  };
  createdAt: string;
};

export type OrderRequest = {
  idempotencyKey: string;
  variantId: string;
  quantity: number;
  customer: { name: string; email: string };
  delivery: { recipientName: string; address: string; city: string; phone: string };
  cardToken: string;
  acceptanceToken: string;
  personalAuthToken: string;
};
