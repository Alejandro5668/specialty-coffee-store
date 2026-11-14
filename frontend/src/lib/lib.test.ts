import { formatCop } from './money';
import { stockLabel } from './stock';

describe('formatCop', () => {
  it.each([
    [3_200_000, '$32.000'],
    [750_000, '$7.500'],
    [100, '$1'],
    [0, '$0'],
    [123_456_700, '$1.234.567'],
    [99_999_999_900, '$999.999.999'],
  ])('writes %i cents as %s, the way Colombians read pesos', (cents, text) => {
    expect(formatCop(cents)).toBe(text);
  });

  it.each([NaN, Infinity, -5, 1.5])('never prints a made-up amount for %p', (cents) => {
    expect(formatCop(cents)).toBe('-');
  });
});

describe('stockLabel', () => {
  it.each([
    [0, 'Agotado'],
    [1, 'Queda 1'],
    [5, 'Quedan 5'],
    [6, '6 disponibles'],
    [20, '20 disponibles'],
    [-3, 'Agotado'],
    [NaN, 'Agotado'],
  ])('says %p as "%s"', (stock, text) => {
    expect(stockLabel(stock)).toBe(text);
  });
});
