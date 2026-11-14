import { err, ok, Result } from '../../src/domain/shared/result';
import {
  EventError,
  EventVerifier,
  PaymentEvent,
} from '../../src/application/ports/event.verifier';

/** Accepts `{ signature: 'valid', ...PaymentEvent }`; anything else is rejected. */
export class FakeVerifier implements EventVerifier {
  verify(payload: unknown): Result<PaymentEvent, EventError> {
    const p = payload as Record<string, unknown> | null;
    if (!p || typeof p !== 'object') return err('MALFORMED_EVENT');
    if (p.signature !== 'valid') return err('INVALID_SIGNATURE');
    const { reference, providerRef, status, amountInCents } = p as unknown as PaymentEvent;
    return ok({ reference, providerRef, status, amountInCents });
  }
}
