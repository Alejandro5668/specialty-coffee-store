import { createHash } from 'node:crypto';
import { err, ok, Result } from '../../domain/shared/result';
import {
  Acceptance,
  ChargeRequest,
  Contract,
  GatewayCharge,
  GatewayError,
  PaymentGateway,
} from '../../application/ports/payment.gateway';
import { PaymentConfig } from './config';

type Json = Record<string, unknown>;

const UNAVAILABLE = err('GATEWAY_UNAVAILABLE' as const);

/** 408 and 429 say "try later", so the outcome is unknown, unlike a plain refusal. */
const isRefusal = (status: number): boolean =>
  status >= 400 && status < 500 && status !== 408 && status !== 429;

const toStatus = (provider: unknown): GatewayCharge['status'] => {
  switch (provider) {
    case 'APPROVED':
    case 'DECLINED':
    case 'ERROR':
      return provider;
    case 'VOIDED':
      return 'DECLINED';
    default:
      return 'PENDING';
  }
};

const toCharge = (data: unknown): GatewayCharge | null => {
  const t = data as Json | null;
  return t && typeof t.id === 'string' && t.id !== ''
    ? { providerRef: t.id, status: toStatus(t.status) }
    : null;
};

const toContract = (value: unknown): Contract | null => {
  const c = value as Json | null;
  if (!c || typeof c.acceptance_token !== 'string' || c.acceptance_token === '') return null;
  if (typeof c.permalink !== 'string') return null;
  // The link is shown to the shopper, so anything but a plain https URL is refused.
  try {
    if (new URL(c.permalink).protocol !== 'https:') return null;
  } catch {
    return null;
  }
  return { token: c.acceptance_token, permalink: c.permalink };
};

export class HttpPaymentGateway implements PaymentGateway {
  constructor(
    private readonly config: PaymentConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  /** Public key only. The browser cannot call this itself: the provider sends no CORS headers for it. */
  async getAcceptance(): Promise<Result<Acceptance, 'GATEWAY_UNAVAILABLE'>> {
    const response = await this.send('/merchants/info', 'GET', undefined, {
      'x-merchant-public-key': this.config.publicKey,
    });
    if (!response?.ok) return UNAVAILABLE;

    const data = (await this.json(response)) as Json | null;
    const merchant = data?.data as Json | undefined;
    const acceptance = toContract(merchant?.presigned_acceptance);
    const personalData = toContract(merchant?.presigned_personal_data_auth);
    return acceptance && personalData ? ok({ acceptance, personalData }) : UNAVAILABLE;
  }

  async charge(request: ChargeRequest): Promise<Result<GatewayCharge, GatewayError>> {
    const response = await this.send('/transactions', 'POST', {
      acceptance_token: request.acceptanceToken,
      accept_personal_auth: request.personalAuthToken,
      amount_in_cents: request.amountInCents,
      currency: 'COP',
      customer_email: request.customerEmail,
      reference: request.reference,
      signature: this.sign(request),
      payment_method: { type: 'CARD', token: request.cardToken, installments: 1 },
    });
    if (!response) return UNAVAILABLE;
    if (isRefusal(response.status)) return err('GATEWAY_REJECTED');
    if (!response.ok) return UNAVAILABLE;

    const charge = toCharge(((await this.json(response)) as Json | null)?.data);
    return charge ? ok(charge) : UNAVAILABLE;
  }

  /** Unverified against the sandbox (it was down when this was written): confirm the query and its shape. */
  async findByReference(
    reference: string,
  ): Promise<Result<GatewayCharge | null, 'GATEWAY_UNAVAILABLE'>> {
    const response = await this.send(
      `/transactions?reference=${encodeURIComponent(reference)}`,
      'GET',
    );
    if (!response) return UNAVAILABLE;
    if (response.status === 404) return ok(null);
    if (!response.ok) return UNAVAILABLE;

    const data = ((await this.json(response)) as Json | null)?.data;
    const matches = (Array.isArray(data) ? data : [data]).filter(
      (t) => (t as Json | null)?.reference === reference,
    );
    return ok(matches.length > 0 ? toCharge(matches[0]) : null);
  }

  private sign(request: ChargeRequest): string {
    return createHash('sha256')
      .update(`${request.reference}${request.amountInCents}COP${this.config.integritySecret}`)
      .digest('hex');
  }

  /** Returns null on any transport failure, so callers see one "unknown outcome" case. */
  private async send(
    path: string,
    method: 'GET' | 'POST',
    body?: Json,
    credentials: Record<string, string> = { Authorization: `Bearer ${this.config.privateKey}` },
  ): Promise<Response | null> {
    try {
      return await this.fetchFn(`${this.config.baseUrl}${path}`, {
        method,
        headers: {
          ...credentials,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch {
      return null;
    }
  }

  private async json(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
}
