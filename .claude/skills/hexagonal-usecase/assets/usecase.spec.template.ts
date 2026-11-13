import { CreateCheckout, StockRepository } from './create-checkout';

const fakeStock = (available: boolean): StockRepository => ({
  reserve: jest.fn().mockResolvedValue(available),
  release: jest.fn(),
});

describe('CreateCheckout', () => {
  it('reserves stock when available', async () => {
    const result = await new CreateCheckout(fakeStock(true)).execute({ variantId: 'v1', quantity: 1 });
    expect(result).toEqual({ ok: true, value: { reserved: true } });
  });

  it('fails with OUT_OF_STOCK and never charges', async () => {
    const result = await new CreateCheckout(fakeStock(false)).execute({ variantId: 'v1', quantity: 1 });
    expect(result).toEqual({ ok: false, error: 'OUT_OF_STOCK' });
  });

  it.each([0, -1, 1.5, NaN])('rejects invalid quantity %p', async (quantity) => {
    const result = await new CreateCheckout(fakeStock(true)).execute({ variantId: 'v1', quantity });
    expect(result).toEqual({ ok: false, error: 'INVALID_INPUT' });
  });
});
