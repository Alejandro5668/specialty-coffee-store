import { err, ok, Result } from '../../src/domain/shared/result';
import {
  Acceptance,
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
  acceptance: Result<Acceptance, 'GATEWAY_UNAVAILABLE'> = ok({
    acceptance: { token: 'acc_123', permalink: 'https://example.test/terms.pdf' },
    personalData: { token: 'per_123', permalink: 'https://example.test/data.pdf' },
  });
  acceptanceCalls = 0;

  async getAcceptance(): Promise<Result<Acceptance, 'GATEWAY_UNAVAILABLE'>> {
    this.acceptanceCalls++;
    return this.acceptance;
  }

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
