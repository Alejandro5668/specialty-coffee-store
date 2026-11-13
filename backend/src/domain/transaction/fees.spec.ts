import { money } from '../shared/money';
import { err } from '../shared/result';
import { BASE_FEE_CENTS, DELIVERY_FEE_CENTS, MAX_QUANTITY, calculateAmounts } from './fees';

const price = (cents: number) => {
  const r = money(cents);
  if (!r.ok) throw new Error('setup');
  return r.value;
};

describe('calculateAmounts', () => {
  it('uses a base fee of 3.000 COP and a delivery fee of 8.000 COP', () => {
    expect(BASE_FEE_CENTS).toBe(300_000);
    expect(DELIVERY_FEE_CENTS).toBe(800_000);
  });

  it('adds product, base fee and delivery fee', () => {
    const result = calculateAmounts(price(3_500_000), 2);
    expect(result).toEqual({
      ok: true,
      value: {
        productAmount: price(7_000_000),
        baseFee: price(300_000),
        deliveryFee: price(800_000),
        total: price(8_100_000),
      },
    });
  });

  it('accepts the maximum quantity', () => {
    expect(calculateAmounts(price(100), MAX_QUANTITY).ok).toBe(true);
  });

  it.each([0, -1, 1.5, NaN, MAX_QUANTITY + 1, 1_000_000])('rejects quantity %p', (quantity) => {
    expect(calculateAmounts(price(100), quantity)).toEqual(err('INVALID_QUANTITY'));
  });

  it('rejects an amount that overflows the safe range', () => {
    expect(calculateAmounts(price(Number.MAX_SAFE_INTEGER), 2)).toEqual(err('INVALID_AMOUNT'));
  });
});
