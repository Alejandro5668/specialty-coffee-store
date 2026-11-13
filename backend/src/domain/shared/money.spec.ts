import { add, money, times } from './money';
import { err, ok } from './result';

describe('money', () => {
  it('creates COP money from integer cents', () => {
    expect(money(3_000_00)).toEqual(ok({ amountInCents: 300_000, currency: 'COP' }));
  });

  it('accepts zero', () => {
    expect(money(0).ok).toBe(true);
  });

  it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects %p', (value) => {
    expect(money(value)).toEqual(err('INVALID_AMOUNT'));
  });

  it('rejects non-numbers coming from untrusted input', () => {
    expect(money('100' as unknown as number)).toEqual(err('INVALID_AMOUNT'));
  });

  it('adds two amounts', () => {
    const a = money(100);
    const b = money(250);
    if (!a.ok || !b.ok) throw new Error('setup');
    expect(add(a.value, b.value)).toEqual(money(350));
  });

  it('rejects an addition that overflows the safe range', () => {
    const big = money(Number.MAX_SAFE_INTEGER);
    if (!big.ok) throw new Error('setup');
    expect(add(big.value, big.value)).toEqual(err('INVALID_AMOUNT'));
  });

  it('multiplies by a positive integer quantity', () => {
    const a = money(250);
    if (!a.ok) throw new Error('setup');
    expect(times(a.value, 3)).toEqual(money(750));
  });

  it.each([0, -2, 1.5, NaN])('rejects quantity %p', (quantity) => {
    const a = money(250);
    if (!a.ok) throw new Error('setup');
    expect(times(a.value, quantity)).toEqual(err('INVALID_QUANTITY'));
  });

  it('rejects a multiplication that overflows', () => {
    const a = money(Number.MAX_SAFE_INTEGER);
    if (!a.ok) throw new Error('setup');
    expect(times(a.value, 2)).toEqual(err('INVALID_AMOUNT'));
  });
});
