import { Result } from '../../domain/shared/result';
import { FinalStatus } from '../../domain/transaction/transaction';

export type PaymentEvent = {
  reference: string;
  providerRef: string;
  status: 'PENDING' | FinalStatus;
  amountInCents: number;
};
export type EventError = 'INVALID_SIGNATURE' | 'MALFORMED_EVENT';

export interface EventVerifier {
  verify(payload: unknown): Result<PaymentEvent, EventError>;
}
