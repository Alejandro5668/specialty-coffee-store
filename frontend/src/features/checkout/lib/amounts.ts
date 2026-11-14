import { CheckoutOptions } from '../../../api/types';

export type Totals = {
  productInCents: number;
  baseFeeInCents: number;
  deliveryFeeInCents: number;
  totalInCents: number;
};

/**
 * Only to show the shopper what is coming. The server computes the real amounts when the order is
 * placed, and the order page shows those.
 */
export const computeTotals = (
  unitPriceInCents: number,
  quantity: number,
  fees: Pick<CheckoutOptions['fees'], 'baseFeeInCents' | 'deliveryFeeInCents'>,
): Totals => {
  const productInCents = unitPriceInCents * quantity;
  return {
    productInCents,
    baseFeeInCents: fees.baseFeeInCents,
    deliveryFeeInCents: fees.deliveryFeeInCents,
    totalInCents: productInCents + fees.baseFeeInCents + fees.deliveryFeeInCents,
  };
};
