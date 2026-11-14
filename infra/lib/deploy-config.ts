export type DeployConfig = { paymentApiUrl: string; paymentPublicKey: string };

const need = (env: Record<string, string | undefined>, name: string): string => {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

/** Only public settings go into the template. Secrets are read from SSM at run time. */
export const loadDeployConfig = (env: Record<string, string | undefined>): DeployConfig => {
  const url = need(env, 'PAYMENT_API_URL');
  if (!url.startsWith('https://')) throw new Error('PAYMENT_API_URL must be an https URL');
  const key = need(env, 'PAYMENT_PUBLIC_KEY');
  if (key.startsWith('prv_')) throw new Error('PAYMENT_PUBLIC_KEY must be the public key');
  return { paymentApiUrl: url.replace(/\/+$/, ''), paymentPublicKey: key };
};
