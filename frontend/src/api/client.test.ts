import { html, json, recordFetch } from '../test/http';
import { ApiError, createCoffeeApi } from './client';

const product = (over: Record<string, unknown> = {}) => ({
  id: 'huila-washed',
  name: 'Huila Lavado',
  description: 'Caramel and red apple.',
  imageUrl: '/images/coffees/huila-washed.webp',
  variants: [
    { id: 'huila-washed-250', sizeGrams: 250, priceInCents: 3_200_000, currency: 'COP', stock: 5 },
    { id: 'huila-washed-500', sizeGrams: 500, priceInCents: 5_800_000, currency: 'COP', stock: 0 },
  ],
  ...over,
});

const withFetch = (respond: () => Response | Promise<Response>) => {
  const { fetchFn, calls } = recordFetch(respond);
  return { api: createCoffeeApi('https://api.example.test/', fetchFn), calls };
};

const failure = async (promise: Promise<unknown>): Promise<ApiError> => {
  try {
    await promise;
  } catch (e) {
    return e as ApiError;
  }
  throw new Error('expected a failure');
};

describe('listProducts', () => {
  it('reads the catalog with a plain GET and a timeout', async () => {
    const { api, calls } = withFetch(() => json(200, [product()]));
    const products = await api.listProducts();
    expect(products).toHaveLength(1);
    expect(products[0].variants[1].stock).toBe(0);
    expect(calls[0].url).toBe('https://api.example.test/products');
    expect(calls[0].init.method).toBe('GET');
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
  });

  it('uses the message and code the server sends for its own errors', async () => {
    const { api } = withFetch(() =>
      json(429, { statusCode: 429, code: 'THROTTLED', message: 'Slow down a little.' }),
    );
    const error = await failure(api.listProducts());
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 429, code: 'THROTTLED', message: 'Slow down a little.' });
  });

  it.each([500, 502, 503])('says something plain on a %s with no usable body', async (status) => {
    const { api } = withFetch(() => html(status));
    const error = await failure(api.listProducts());
    expect(error.status).toBe(status);
    expect(error.message).toBe('Algo salió mal de nuestro lado. Inténtalo de nuevo en un minuto.');
  });

  it('says so plainly when the network fails or times out', async () => {
    const { api } = withFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    const error = await failure(api.listProducts());
    expect(error).toMatchObject({ code: 'NETWORK', status: 0 });
    expect(error.message).toBe(
      'No pudimos conectar con la tienda. Revisa tu conexión e inténtalo de nuevo.',
    );
  });

  it.each([
    ['not an array', { products: [] }],
    ['text', 'hello'],
    ['a product with no name', [product({ name: undefined })]],
    ['a product with no variants array', [product({ variants: 'none' })]],
    [
      'a negative price',
      [
        product({
          variants: [{ id: 'a', sizeGrams: 250, priceInCents: -1, currency: 'COP', stock: 1 }],
        }),
      ],
    ],
    [
      'a fractional stock',
      [
        product({
          variants: [{ id: 'a', sizeGrams: 250, priceInCents: 100, currency: 'COP', stock: 1.5 }],
        }),
      ],
    ],
    [
      'a size we do not sell',
      [
        product({
          variants: [{ id: 'a', sizeGrams: 300, priceInCents: 100, currency: 'COP', stock: 1 }],
        }),
      ],
    ],
    [
      'another currency',
      [
        product({
          variants: [{ id: 'a', sizeGrams: 250, priceInCents: 100, currency: 'USD', stock: 1 }],
        }),
      ],
    ],
    ['an image from another site', [product({ imageUrl: 'https://evil.example.com/x.webp' })]],
    ['a protocol-relative image', [product({ imageUrl: '//evil.example.com/x.webp' })]],
    ['a script URL as image', [product({ imageUrl: 'javascript:alert(1)' })]],
  ])('refuses an answer with %s, without showing it', async (_label, body) => {
    const { api } = withFetch(() => json(200, body));
    const error = await failure(api.listProducts());
    expect(error).toMatchObject({ code: 'BAD_RESPONSE' });
    expect(error.message).toBe('Algo salió mal de nuestro lado. Inténtalo de nuevo en un minuto.');
  });
});
