import { ProductView, VariantView } from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface CoffeeApi {
  listProducts(): Promise<ProductView[]>;
}

const NETWORK_MESSAGE = 'We could not reach the store. Check your connection and try again.';
const SERVER_MESSAGE = 'Something went wrong on our side. Try again in a minute.';
const TIMEOUT_MS = 10_000;

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Images come from our own site only: a path, never another origin or a script URL. */
const isLocalPath = (v: unknown): v is string =>
  isText(v) && v.startsWith('/') && !v.startsWith('//');

const isVariant = (v: unknown): v is VariantView =>
  isObject(v) &&
  isText(v.id) &&
  (v.sizeGrams === 250 || v.sizeGrams === 500) &&
  isCount(v.priceInCents) &&
  v.currency === 'COP' &&
  isCount(v.stock);

const isProduct = (v: unknown): v is ProductView =>
  isObject(v) &&
  isText(v.id) &&
  isText(v.name) &&
  typeof v.description === 'string' &&
  isLocalPath(v.imageUrl) &&
  Array.isArray(v.variants) &&
  v.variants.every(isVariant);

export const createCoffeeApi = (baseUrl: string, fetchFn: typeof fetch): CoffeeApi => {
  const root = baseUrl.replace(/\/+$/, '');

  const get = async (path: string): Promise<unknown> => {
    let response: Response;
    try {
      response = await fetchFn(`${root}${path}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new ApiError(0, 'NETWORK', NETWORK_MESSAGE);
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = isObject(body) && isText(body.message) ? body.message : SERVER_MESSAGE;
      const code = isObject(body) && isText(body.code) ? body.code : 'SERVER';
      throw new ApiError(response.status, code, message);
    }
    return body;
  };

  return {
    async listProducts() {
      const body = await get('/products');
      if (!Array.isArray(body) || !body.every(isProduct)) {
        throw new ApiError(200, 'BAD_RESPONSE', SERVER_MESSAGE);
      }
      return body;
    },
  };
};
