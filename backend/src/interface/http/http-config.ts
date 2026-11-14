export type HttpConfig = { corsOrigins: string[]; trustProxyHops: number };

const refuseOrigin = (): never => {
  throw new Error('CORS_ORIGIN must be a comma-separated list of exact http(s) origins, never *');
};

const parseOrigin = (value: string): string => {
  try {
    const url = new URL(value);
    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.origin === value)
      return value;
  } catch {
    // not a URL: refused below
  }
  return refuseOrigin();
};

export const loadHttpConfig = (env: Record<string, string | undefined>): HttpConfig => {
  const origins = (env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((o) => o.trim());
  const hops = env.TRUST_PROXY_HOPS ?? '0';
  if (!/^[0-5]$/.test(hops)) throw new Error('TRUST_PROXY_HOPS must be a whole number from 0 to 5');
  return { corsOrigins: origins.map(parseOrigin), trustProxyHops: Number(hops) };
};
