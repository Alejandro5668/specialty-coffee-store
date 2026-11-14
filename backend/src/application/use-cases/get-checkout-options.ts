import { map, Result } from '../../domain/shared/result';
import { BASE_FEE_CENTS, DELIVERY_FEE_CENTS, MAX_QUANTITY } from '../../domain/transaction/fees';
import { Acceptance, Contract, PaymentGateway } from '../ports/payment.gateway';

export type CheckoutOptions = {
  acceptance: Contract;
  personalData: Contract;
  fees: { currency: 'COP'; baseFeeInCents: number; deliveryFeeInCents: number };
  maxQuantity: number;
};

/**
 * What the checkout screens need before the shopper pays: the terms to accept (single-use tokens,
 * so never cached) and the fees, taken from the same constants the charge uses.
 */
export class GetCheckoutOptions {
  constructor(private readonly gateway: PaymentGateway) {}

  async execute(): Promise<Result<CheckoutOptions, 'GATEWAY_UNAVAILABLE'>> {
    const acceptance = await this.gateway.getAcceptance();
    return map(acceptance, (tokens: Acceptance) => ({
      ...tokens,
      fees: {
        currency: 'COP' as const,
        baseFeeInCents: BASE_FEE_CENTS,
        deliveryFeeInCents: DELIVERY_FEE_CENTS,
      },
      maxQuantity: MAX_QUANTITY,
    }));
  }
}
