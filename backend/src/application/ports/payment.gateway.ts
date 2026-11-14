import { Result } from '../../domain/shared/result';
import { FinalStatus } from '../../domain/transaction/transaction';

export type ChargeRequest = {
  reference: string;
  amountInCents: number;
  customerEmail: string;
  cardToken: string;
  acceptanceToken: string;
  personalAuthToken: string;
};
export type GatewayCharge = { providerRef: string; status: 'PENDING' | FinalStatus };
/** REJECTED: the provider refused the request. UNAVAILABLE: timeout or 5xx, outcome unknown. */
export type GatewayError = 'GATEWAY_REJECTED' | 'GATEWAY_UNAVAILABLE';

export type Contract = { token: string; permalink: string };
/** Single-use tokens the shopper accepts before paying; each charge needs a fresh pair. */
export type Acceptance = { acceptance: Contract; personalData: Contract };

export interface PaymentGateway {
  getAcceptance(): Promise<Result<Acceptance, 'GATEWAY_UNAVAILABLE'>>;
  charge(request: ChargeRequest): Promise<Result<GatewayCharge, GatewayError>>;
  findByReference(reference: string): Promise<Result<GatewayCharge | null, 'GATEWAY_UNAVAILABLE'>>;
}
