export type PaymentConfig = {
  baseUrl: string;
  publicKey: string;
  privateKey: string;
  integritySecret: string;
  eventsSecret: string;
  timeoutMs: number;
};

const required = (env: Record<string, string | undefined>, name: string): string => {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const httpsUrl = (value: string): string => {
  try {
    if (new URL(value).protocol === 'https:') return value.replace(/\/+$/, '');
  } catch {
    // falls through to the error below
  }
  throw new Error('PAYMENT_API_URL must be an https URL');
};

export const loadPaymentConfig = (env: Record<string, string | undefined>): PaymentConfig => ({
  baseUrl: httpsUrl(required(env, 'PAYMENT_API_URL')),
  publicKey: required(env, 'PAYMENT_PUBLIC_KEY'),
  privateKey: required(env, 'PAYMENT_PRIVATE_KEY'),
  integritySecret: required(env, 'PAYMENT_INTEGRITY_SECRET'),
  eventsSecret: required(env, 'PAYMENT_EVENTS_SECRET'),
  timeoutMs: 10_000,
});
