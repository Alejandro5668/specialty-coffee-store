import { money } from '../shared/money';
import { err } from '../shared/result';
import { Amounts, createTransaction, settle, Transaction } from './transaction';

const m = (cents: number) => {
  const r = money(cents);
  if (!r.ok) throw new Error('setup');
  return r.value;
};

const amounts: Amounts = {
  productAmount: m(35_000_00),
  baseFee: m(3_000_00),
  deliveryFee: m(8_000_00),
  total: m(46_000_00),
};

const delivery = { recipientName: 'Ana', address: 'Calle 1', city: 'Cali', phone: '3001234567' };

const pending = (): Transaction => {
  const r = createTransaction({
    id: 't1',
    customerId: 'c1',
    variantId: 'v1',
    quantity: 1,
    amounts,
    delivery,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  if (!r.ok) throw new Error('setup');
  return r.value;
};

describe('createTransaction', () => {
  it('starts as PENDING without a provider reference', () => {
    expect(pending()).toMatchObject({ id: 't1', status: 'PENDING', providerRef: null });
  });

  it('embeds the delivery data', () => {
    expect(pending().delivery).toEqual(delivery);
  });

  it('rejects a total that does not match its parts', () => {
    const result = createTransaction({
      id: 't1',
      customerId: 'c1',
      variantId: 'v1',
      quantity: 1,
      amounts: { ...amounts, total: m(1) },
      delivery,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result).toEqual(err('AMOUNT_MISMATCH'));
  });

  it.each([0, -1, 1.5])('rejects quantity %p', (quantity) => {
    const result = createTransaction({
      id: 't1',
      customerId: 'c1',
      variantId: 'v1',
      quantity,
      amounts,
      delivery,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result).toEqual(err('INVALID_QUANTITY'));
  });
});

describe('settle', () => {
  it.each(['APPROVED', 'DECLINED', 'ERROR'] as const)('moves PENDING to %s', (status) => {
    const result = settle(pending(), status, 'provider-1');
    expect(result).toMatchObject({ ok: true, value: { status, providerRef: 'provider-1' } });
  });

  it('refuses to settle with PENDING', () => {
    expect(settle(pending(), 'PENDING' as 'APPROVED', 'p')).toEqual(err('INVALID_STATUS'));
  });

  it('keeps a final transaction untouched, so a replayed webhook changes nothing', () => {
    const approved = settle(pending(), 'APPROVED', 'p1');
    if (!approved.ok) throw new Error('setup');
    expect(settle(approved.value, 'DECLINED', 'p2')).toEqual(err('ALREADY_FINAL'));
    expect(settle(approved.value, 'APPROVED', 'p1')).toEqual(err('ALREADY_FINAL'));
  });
});
