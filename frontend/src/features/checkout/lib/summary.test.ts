import { draft } from '../../../test/state';
import { computeTotals } from './amounts';
import { isDetailsComplete } from './draft';

describe('computeTotals', () => {
  const fees = { baseFeeInCents: 300_000, deliveryFeeInCents: 800_000 };

  it('adds the coffee, the base fee and the delivery fee', () => {
    expect(computeTotals(3_200_000, 2, fees)).toEqual({
      productInCents: 6_400_000,
      baseFeeInCents: 300_000,
      deliveryFeeInCents: 800_000,
      totalInCents: 7_500_000,
    });
  });

  it('is the same arithmetic the server does, one unit at a time', () => {
    expect(computeTotals(5_800_000, 1, fees).totalInCents).toBe(6_900_000);
    expect(computeTotals(5_800_000, 10, fees).totalInCents).toBe(59_100_000);
  });
});

describe('isDetailsComplete', () => {
  it('is true for a shopper who chose a coffee, filled the form and accepted the terms', () => {
    expect(isDetailsComplete(draft())).toBe(true);
  });

  it('is true without a recipient name, which is optional', () => {
    const state = draft({
      delivery: { recipientName: '', address: 'Calle 1', city: 'Cali', phone: '3001234567' },
    });
    expect(isDetailsComplete(state)).toBe(true);
  });

  it.each([
    ['no coffee', draft({ variantId: null })],
    ['no name', draft({ customer: { name: '', email: 'ana@example.com' } })],
    ['a bad email', draft({ customer: { name: 'Ana', email: 'ana' } })],
    [
      'no address',
      draft({
        delivery: { recipientName: 'Ana', address: '', city: 'Cali', phone: '3001234567' },
      }),
    ],
    [
      'markup in the address',
      draft({
        delivery: { recipientName: 'Ana', address: '<b>x</b>', city: 'Cali', phone: '3001234567' },
      }),
    ],
    [
      'a bad phone',
      draft({ delivery: { recipientName: 'Ana', address: 'Calle 1', city: 'Cali', phone: 'abc' } }),
    ],
    ['the terms not accepted', draft({ accepted: { terms: false, personalData: true } })],
    [
      'the data authorization not accepted',
      draft({ accepted: { terms: true, personalData: false } }),
    ],
  ])('is false with %s', (_label, state) => {
    expect(isDetailsComplete(state)).toBe(false);
  });
});
