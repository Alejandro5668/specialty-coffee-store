import { HttpPaymentGateway } from '../../src/infrastructure/payments/http-payment.gateway';

export const config = {
  baseUrl: 'https://sandbox.example.test/v1',
  publicKey: 'pub_test_public',
  privateKey: 'prv_test_secret',
  integritySecret: 'prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6',
  eventsSecret: 'test_events_x',
  timeoutMs: 5_000,
};

export type Call = { url: string; init: RequestInit };
export const reply = (status: number, body: unknown) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

export const gatewayWith = (respond: () => Response | Promise<Response>) => {
  const calls: Call[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return respond();
  }) as unknown as typeof fetch;
  return { gateway: new HttpPaymentGateway(config, fetchFn), calls };
};
