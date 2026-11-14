import { err, ok, Result } from '../../src/domain/shared/result';
import {
  ChargeRequest,
  GatewayCharge,
  GatewayError,
  PaymentGateway,
} from '../../src/application/ports/payment.gateway';

type Script = Result<GatewayCharge, GatewayError>;

export class FakeGateway implements PaymentGateway {
  readonly charges: ChargeRequest[] = [];
  next: Script = ok({ providerRef: 'prov-1', status: 'PENDING' });
  known = new Map<string, GatewayCharge>();
  lookupFails = false;
  lookups = 0;

  async charge(request: ChargeRequest): Promise<Script> {
    this.charges.push(request);
    return this.next;
  }

  async findByReference(
    reference: string,
  ): Promise<Result<GatewayCharge | null, 'GATEWAY_UNAVAILABLE'>> {
    this.lookups++;
    if (this.lookupFails) return err('GATEWAY_UNAVAILABLE');
    return ok(this.known.get(reference) ?? null);
  }
}
