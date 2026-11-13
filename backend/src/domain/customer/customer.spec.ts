import { err, ok } from '../shared/result';
import { createCustomer } from './customer';

describe('createCustomer', () => {
  it('trims and keeps valid data', () => {
    expect(createCustomer({ id: 'c1', name: '  Ana Pérez ', email: 'ana@example.com' })).toEqual(
      ok({ id: 'c1', name: 'Ana Pérez', email: 'ana@example.com' }),
    );
  });

  it.each(['', '   ', 'a'.repeat(101)])('rejects name %p', (name) => {
    expect(createCustomer({ id: 'c1', name, email: 'ana@example.com' })).toEqual(
      err('INVALID_NAME'),
    );
  });

  it.each(['', 'ana', 'ana@', '@example.com', 'a b@example.com', `${'a'.repeat(250)}@x.co`])(
    'rejects email %p',
    (email) => {
      expect(createCustomer({ id: 'c1', name: 'Ana', email })).toEqual(err('INVALID_EMAIL'));
    },
  );

  it('rejects non-string input from untrusted sources', () => {
    expect(createCustomer({ id: 'c1', name: 5 as unknown as string, email: 'a@b.co' })).toEqual(
      err('INVALID_NAME'),
    );
  });
});
