import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';

export const SECRET_NAMES = [
  'PAYMENT_PRIVATE_KEY',
  'PAYMENT_INTEGRITY_SECRET',
  'PAYMENT_EVENTS_SECRET',
] as const;

type Env = Record<string, string | undefined>;

/**
 * Which secrets live in SSM: `<NAME>_SSM` holds the parameter name. A secret that is already set
 * (a local .env) is never read from SSM, so development needs no AWS access.
 */
export const secretParameters = (env: Env): Record<string, string> =>
  Object.fromEntries(
    SECRET_NAMES.flatMap((name) => {
      const parameter = env[`${name}_SSM`]?.trim();
      return parameter && !env[name]?.trim() ? [[name, parameter]] : [];
    }),
  );

/**
 * Reads the parameters in one request, decrypted. Errors name the parameters, never a value.
 * (GetParameters takes up to 10 names; there are three secrets.)
 */
export const loadSecrets = async (
  client: Pick<SSMClient, 'send'>,
  parameters: Record<string, string>,
): Promise<Record<string, string>> => {
  const names = Object.values(parameters);
  if (names.length === 0) return {};

  let response;
  try {
    response = await client.send(new GetParametersCommand({ Names: names, WithDecryption: true }));
  } catch {
    throw new Error('Could not read the payment secrets from SSM Parameter Store.');
  }

  const missing = response.InvalidParameters ?? [];
  const values = new Map((response.Parameters ?? []).map((p) => [p.Name, p.Value]));
  const empty = names.filter((name) => !values.get(name)?.trim());
  const unreadable = [...new Set([...missing, ...empty])];
  if (unreadable.length > 0) {
    throw new Error(`Missing or empty SSM parameters: ${unreadable.join(', ')}`);
  }

  return Object.fromEntries(
    Object.entries(parameters).map(([env, name]) => [env, values.get(name) as string]),
  );
};
