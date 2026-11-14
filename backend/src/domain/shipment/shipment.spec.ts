import { money } from '../shared/money';
import { createTransaction, settle, Transaction } from '../transaction/transaction';
import { assignShipment } from './shipment';

const m = (cents: number) => {
  const r = money(cents);
  if (!r.ok) throw new Error('setup');
  return r.value;
};

const pending = (): Transaction => {
  const r = createTransaction({
    id: 't1',
    customerId: 'c1',
    variantId: 'v1',
    quantity: 2,
    amounts: {
      productAmount: m(70_000_00),
      baseFee: m(3_000_00),
      deliveryFee: m(8_000_00),
      total: m(81_000_00),
    },
    delivery: { recipientName: 'Ana', address: 'Calle 1', city: 'Cali', phone: '3001234567' },
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  if (!r.ok) throw new Error('setup');
  return r.value;
};
const final = (status: 'APPROVED' | 'DECLINED' | 'ERROR') => {
  const r = settle(pending(), status, 'prov-1');
  if (!r.ok) throw new Error('setup');
  return r.value;
};

describe('assignShipment', () => {
  it('assigns the purchased product to the customer once the payment is approved', () => {
    const result = assignShipment(final('APPROVED'));
    expect(result).toEqual({
      ok: true,
      value: {
        id: 't1',
        customerId: 'c1',
        variantId: 'v1',
        quantity: 2,
        recipientName: 'Ana',
        address: 'Calle 1',
        city: 'Cali',
        phone: '3001234567',
        status: 'ASSIGNED',
      },
    });
  });

  it.each(['DECLINED', 'ERROR'] as const)('assigns nothing when the payment is %s', (status) => {
    expect(assignShipment(final(status))).toEqual({ ok: false, error: 'NOT_APPROVED' });
  });

  it('assigns nothing while the payment is still PENDING', () => {
    expect(assignShipment(pending())).toEqual({ ok: false, error: 'NOT_APPROVED' });
  });
});
