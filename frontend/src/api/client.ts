import {
  CheckoutOptions,
  Contract,
  OrderRequest,
  ProductView,
  TransactionView,
  VariantView,
} from './types';

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
  getCheckoutOptions(): Promise<CheckoutOptions>;
  createOrder(request: OrderRequest): Promise<TransactionView>;
  getTransaction(id: string): Promise<TransactionView>;
}

const NETWORK_MESSAGE = 'We could not reach the store. Check your connection and try again.';
const ORDER_NETWORK_MESSAGE =
  'We could not confirm your order. Press Pay again: you will not be charged twice.';
const SERVER_MESSAGE = 'Something went wrong on our side. Try again in a minute.';
const READ_TIMEOUT_MS = 10_000;
/** Paying waits for the card network, so it gets more time than a read. */
const WRITE_TIMEOUT_MS = 20_000;
const STATUSES = ['PENDING', 'APPROVED', 'DECLINED', 'ERROR'];

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isCount = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Images come from our own site only: a path, never another origin or a script URL. */
const isLocalPath = (v: unknown): v is string =>
  isText(v) && v.startsWith('/') && !v.startsWith('//');

/** Links shown to the shopper must be plain https, never a script or another scheme. */
const isHttpsUrl = (v: unknown): v is string => {
  if (!isText(v)) return false;
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
};

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

const isContract = (v: unknown): v is Contract =>
  isObject(v) && isText(v.token) && isHttpsUrl(v.permalink);

const isOptions = (v: unknown): v is CheckoutOptions =>
  isObject(v) &&
  isContract(v.acceptance) &&
  isContract(v.personalData) &&
  isObject(v.fees) &&
  v.fees.currency === 'COP' &&
  isCount(v.fees.baseFeeInCents) &&
  isCount(v.fees.deliveryFeeInCents) &&
  isCount(v.maxQuantity) &&
  v.maxQuantity >= 1 &&
  v.maxQuantity <= 100;

const isTransaction = (v: unknown): v is TransactionView =>
  isObject(v) &&
  isText(v.id) &&
  typeof v.status === 'string' &&
  STATUSES.includes(v.status) &&
  isText(v.variantId) &&
  Number.isSafeInteger(v.quantity) &&
  (v.quantity as number) >= 1 &&
  isObject(v.amounts) &&
  v.amounts.currency === 'COP' &&
  isCount(v.amounts.productAmountInCents) &&
  isCount(v.amounts.baseFeeInCents) &&
  isCount(v.amounts.deliveryFeeInCents) &&
  isCount(v.amounts.totalInCents) &&
  isText(v.createdAt);

type Request = {
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
  timeoutMs: number;
  networkMessage: string;
};

export const createCoffeeApi = (baseUrl: string, fetchFn: typeof fetch): CoffeeApi => {
  const root = baseUrl.replace(/\/+$/, '');

  const call = async ({
    method,
    path,
    body,
    timeoutMs,
    networkMessage,
  }: Request): Promise<unknown> => {
    let response: Response;
    try {
      response = await fetchFn(`${root}${path}`, {
        method,
        headers:
          body === undefined
            ? { Accept: 'application/json' }
            : { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new ApiError(0, 'NETWORK', networkMessage);
    }
    const answer: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = isObject(answer) && isText(answer.message) ? answer.message : SERVER_MESSAGE;
      const code = isObject(answer) && isText(answer.code) ? answer.code : 'SERVER';
      throw new ApiError(response.status, code, message);
    }
    return answer;
  };

  const read = (path: string) =>
    call({ method: 'GET', path, timeoutMs: READ_TIMEOUT_MS, networkMessage: NETWORK_MESSAGE });

  const refuse = (): never => {
    throw new ApiError(200, 'BAD_RESPONSE', SERVER_MESSAGE);
  };

  return {
    async listProducts() {
      const body = await read('/products');
      return Array.isArray(body) && body.every(isProduct) ? body : refuse();
    },

    async getCheckoutOptions() {
      const body = await read('/checkout/options');
      return isOptions(body) ? body : refuse();
    },

    async createOrder(request) {
      const body = await call({
        method: 'POST',
        path: '/checkout',
        body: request,
        timeoutMs: WRITE_TIMEOUT_MS,
        networkMessage: ORDER_NETWORK_MESSAGE,
      });
      return isTransaction(body) ? body : refuse();
    },

    async getTransaction(id) {
      const body = await read(`/transactions/${encodeURIComponent(id)}`);
      return isTransaction(body) ? body : refuse();
    },
  };
};
