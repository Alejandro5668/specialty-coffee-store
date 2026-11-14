import { html, json, recordFetch } from '../test/http';
import { ApiError, createCoffeeApi } from './client';
import { OrderRequest } from './types';

const options = {
  acceptance: { token: 'eyJ.acc', permalink: 'https://example.test/terms.pdf' },
  personalData: { token: 'eyJ.per', permalink: 'https://example.test/data.pdf' },
  fees: { currency: 'COP', baseFeeInCents: 300_000, deliveryFeeInCents: 800_000 },
  maxQuantity: 10,
};
const view = {
  id: '0b8f5c3e-6f1a-4c47-9d71-2f6a4a1d9c11',
  status: 'PENDING',
  variantId: 'huila-washed-250',
  quantity: 2,
  amounts: {
    currency: 'COP',
    productAmountInCents: 6_400_000,
    baseFeeInCents: 300_000,
    deliveryFeeInCents: 800_000,
    totalInCents: 7_500_000,
  },
  createdAt: '2026-01-01T00:00:00.000Z',
};
const order: OrderRequest = {
  idempotencyKey: 'key-0001-aaaa',
  variantId: 'huila-washed-250',
  quantity: 2,
  customer: { name: 'Ana Pérez', email: 'ana@example.com' },
  delivery: {
    recipientName: 'Ana Pérez',
    address: 'Calle 10 # 5-20',
    city: 'Medellín',
    phone: '3001234567',
  },
  cardToken: 'tok_test_123',
  acceptanceToken: 'acc_1',
  personalAuthToken: 'per_1',
};

const apiWith = (respond: Parameters<typeof recordFetch>[0]) => {
  const { fetchFn, calls } = recordFetch(respond);
  return { api: createCoffeeApi('https://api.example.test', fetchFn), calls };
};
const failure = async (p: Promise<unknown>): Promise<ApiError> => {
  try {
    await p;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected a failure');
};
const SERVER = 'Something went wrong on our side. Try again in a minute.';

describe('getCheckoutOptions', () => {
  it('reads the terms and the fees with a plain GET', async () => {
    const { api, calls } = apiWith(() => json(200, options));
    expect(await api.getCheckoutOptions()).toEqual(options);
    expect(calls[0].url).toBe('https://api.example.test/checkout/options');
    expect(calls[0].init.method).toBe('GET');
  });

  it('passes on the plain message of a 503', async () => {
    const { api } = apiWith(() =>
      json(503, {
        statusCode: 503,
        code: 'GATEWAY_UNAVAILABLE',
        message: 'Try again in a minute.',
      }),
    );
    expect(await failure(api.getCheckoutOptions())).toMatchObject({
      status: 503,
      message: 'Try again in a minute.',
    });
  });

  it.each([
    [
      'a link that is not https',
      { ...options, acceptance: { ...options.acceptance, permalink: 'http://example.test/t.pdf' } },
    ],
    [
      'a script link',
      { ...options, personalData: { ...options.personalData, permalink: 'javascript:alert(1)' } },
    ],
    ['no token', { ...options, acceptance: { permalink: 'https://example.test/t.pdf' } }],
    ['an empty token', { ...options, personalData: { ...options.personalData, token: '' } }],
    ['another currency', { ...options, fees: { ...options.fees, currency: 'USD' } }],
    ['a negative fee', { ...options, fees: { ...options.fees, baseFeeInCents: -1 } }],
    ['a fractional fee', { ...options, fees: { ...options.fees, deliveryFeeInCents: 1.5 } }],
    ['no quantity limit', { ...options, maxQuantity: 0 }],
    ['a huge quantity limit', { ...options, maxQuantity: 1e9 }],
    ['text', 'hello'],
  ])('refuses an answer with %s', async (_label, body) => {
    const { api } = apiWith(() => json(200, body));
    expect(await failure(api.getCheckoutOptions())).toMatchObject({
      code: 'BAD_RESPONSE',
      message: SERVER,
    });
  });
});

describe('createOrder', () => {
  it('posts exactly the order data as JSON and returns the order', async () => {
    const { api, calls } = apiWith(() => json(201, view));
    expect(await api.createOrder(order)).toEqual(view);
    expect(calls[0].url).toBe('https://api.example.test/checkout');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/json',
    );
    expect(JSON.parse(calls[0].init.body as string)).toEqual(order);
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    [409, 'OUT_OF_STOCK', 'There is not enough stock for that quantity. Choose fewer units.'],
    [422, 'INVALID_INPUT', 'Some order details are not valid. Check them and try again.'],
    [429, 'THROTTLED', 'Too many requests. Wait a minute.'],
  ])('keeps the message the server wrote for a %i', async (status, code, message) => {
    const { api } = apiWith(() => json(status, { statusCode: status, code, message }));
    expect(await failure(api.createOrder(order))).toMatchObject({ status, code, message });
  });

  it('tells the shopper they will not be charged twice when the answer never arrives', async () => {
    const { api } = apiWith(() => Promise.reject(new TypeError('Failed to fetch')));
    const error = await failure(api.createOrder(order));
    expect(error).toMatchObject({ code: 'NETWORK', status: 0 });
    expect(error.message).toBe(
      'We could not confirm your order. Press Pay again: you will not be charged twice.',
    );
  });

  it('says something plain on a server error with no usable body', async () => {
    const { api } = apiWith(() => html(502));
    expect(await failure(api.createOrder(order))).toMatchObject({ status: 502, message: SERVER });
  });

  it.each([
    ['an unknown status', { ...view, status: 'PAID' }],
    ['no id', { ...view, id: '' }],
    ['no amounts', { ...view, amounts: undefined }],
    ['a negative total', { ...view, amounts: { ...view.amounts, totalInCents: -5 } }],
    ['a fractional quantity', { ...view, quantity: 1.5 }],
    ['text', 'ok'],
  ])('refuses an answer with %s', async (_label, body) => {
    const { api } = apiWith(() => json(201, body));
    expect(await failure(api.createOrder(order))).toMatchObject({ code: 'BAD_RESPONSE' });
  });
});

describe('getTransaction', () => {
  it('reads an order by id', async () => {
    const { api, calls } = apiWith(() => json(200, { ...view, status: 'APPROVED' }));
    expect((await api.getTransaction(view.id)).status).toBe('APPROVED');
    expect(calls[0].url).toBe(`https://api.example.test/transactions/${view.id}`);
  });

  it('encodes the id so it can never change the path', async () => {
    const { api, calls } = apiWith(() => json(200, view));
    await api.getTransaction('a/b?c=1#x');
    expect(calls[0].url).toBe('https://api.example.test/transactions/a%2Fb%3Fc%3D1%23x');
  });

  it('keeps the server message for an unknown order', async () => {
    const { api } = apiWith(() =>
      json(404, {
        statusCode: 404,
        code: 'TRANSACTION_NOT_FOUND',
        message: 'We could not find that order.',
      }),
    );
    expect(await failure(api.getTransaction('nope'))).toMatchObject({
      status: 404,
      message: 'We could not find that order.',
    });
  });

  it('refuses an answer that is not an order', async () => {
    const { api } = apiWith(() => json(200, { id: 'x' }));
    expect(await failure(api.getTransaction('x'))).toMatchObject({ code: 'BAD_RESPONSE' });
  });
});
