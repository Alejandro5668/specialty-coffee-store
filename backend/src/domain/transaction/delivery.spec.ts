import { err, ok } from '../shared/result';
import { createDelivery } from './delivery';

const valid = {
  recipientName: 'Ana Pérez',
  address: 'Calle 10 # 5-20, Apto 301',
  city: 'Medellín',
  phone: '+573001234567',
};

describe('createDelivery', () => {
  it('accepts valid data and trims it', () => {
    expect(createDelivery({ ...valid, city: ' Medellín ' })).toEqual(ok(valid));
  });

  it.each(['recipientName', 'address', 'city'] as const)('rejects an empty %s', (field) => {
    expect(createDelivery({ ...valid, [field]: '  ' })).toEqual(err('INVALID_FIELD'));
  });

  it.each(['recipientName', 'address', 'city'] as const)('rejects an oversized %s', (field) => {
    expect(createDelivery({ ...valid, [field]: 'x'.repeat(201) })).toEqual(err('INVALID_FIELD'));
  });

  it.each(['<script>alert(1)</script>', 'a\u0000b', 'a\nb'])(
    'rejects markup and control characters: %p',
    (address) => {
      expect(createDelivery({ ...valid, address })).toEqual(err('INVALID_FIELD'));
    },
  );

  it.each(['', '123', 'abc', '+57 300 123', '1'.repeat(16)])('rejects phone %p', (phone) => {
    expect(createDelivery({ ...valid, phone })).toEqual(err('INVALID_PHONE'));
  });
});
