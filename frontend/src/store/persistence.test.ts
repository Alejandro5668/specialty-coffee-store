import { draft, NOW } from '../test/state';
import { CARD_TTL_MS, initialCheckout } from './checkoutState';
import { loadPersisted, PERSIST_KEY, savePersisted, toPersistable } from './persistence';

const memory = (initial?: string) => {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(PERSIST_KEY, initial);
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
};
const stored = (checkout: unknown, v: unknown = 2) => JSON.stringify({ v, checkout });
const full = (over: Record<string, unknown> = {}) => ({
  ...toPersistable(draft({ idempotencyKey: 'key-0001-aaaa' })),
  ...over,
});

describe('what is saved', () => {
  it('round-trips the whole draft', () => {
    const storage = memory();
    const state = draft({ idempotencyKey: 'key-0001-aaaa', orderId: 'order-1' });
    savePersisted(storage, state);
    expect(loadPersisted(storage, NOW)).toEqual({ checkout: state });
  });

  it('leaves out the screen-only fields, so a refresh never starts in the middle of a payment', () => {
    const storage = memory();
    savePersisted(storage, draft({ placing: 'placing', placeError: 'x' }));
    const saved = JSON.parse(storage.data.get(PERSIST_KEY)!);
    expect(Object.keys(saved.checkout)).not.toContain('placing');
    expect(Object.keys(saved.checkout)).not.toContain('placeError');
    expect(loadPersisted(storage, NOW)?.checkout).toMatchObject({
      placing: 'idle',
      placeError: null,
    });
  });

  it('never stores a card number, a security code, a price or an amount', () => {
    const storage = memory();
    savePersisted(storage, draft());
    const raw = storage.data.get(PERSIST_KEY)!;
    expect(raw).not.toMatch(/"(number|cvc|cvv|pan|price|priceInCents|total|amount|amounts)"/i);
    expect(raw).not.toContain('4242424242424242');
  });
});

describe('what is read back', () => {
  it('starts empty when nothing was saved', () => {
    expect(loadPersisted(memory(), NOW)).toBeUndefined();
  });

  it('drops a card token older than 30 minutes, and the key that went with it, but keeps the rest', () => {
    const old = {
      ...toPersistable(draft({ idempotencyKey: 'key-0001-aaaa' })),
      card: { token: 'tok_test_123456', brand: 'visa', last4: '4242', at: NOW - CARD_TTL_MS - 1 },
    };
    const loaded = loadPersisted(memory(stored(old)), NOW)!;
    expect(loaded.checkout).toMatchObject({
      card: null,
      idempotencyKey: null,
      variantId: 'huila-washed-250',
      customer: { name: 'Ana Pérez', email: 'ana@example.com' },
    });
  });

  it('keeps a token that is still fresh', () => {
    const fresh = {
      ...toPersistable(draft()),
      card: {
        token: 'tok_test_123456',
        brand: 'visa',
        last4: '4242',
        at: NOW - CARD_TTL_MS + 1000,
      },
    };
    expect(loadPersisted(memory(stored(fresh)), NOW)!.checkout.card).not.toBeNull();
  });

  it('keeps what the shopper typed even if it is not valid yet, since the form will say so', () => {
    const typed = full({
      delivery: { recipientName: 'Ana', address: '<b>Calle</b>', city: '', phone: 'abc' },
    });
    expect(loadPersisted(memory(stored(typed)), NOW)!.checkout.delivery.address).toBe(
      '<b>Calle</b>',
    );
  });

  it('ignores fields it does not know, such as a price someone added', () => {
    const edited = full({ price: 1, total: 1, amounts: { total: 1 } });
    const loaded = loadPersisted(memory(stored(edited)), NOW)!;
    expect(JSON.stringify(loaded)).not.toMatch(/"price"|"total"|"amounts"/);
  });

  it.each([
    ['text that is not JSON', 'not json {'],
    ['JSON that is not an object', '"hello"'],
    ['null', 'null'],
    ['the old version', stored(full(), 1)],
    ['a version from the future', stored(full(), 3)],
    ['no checkout', JSON.stringify({ v: 2 })],
    ['a checkout that is not an object', stored('x')],
    ['a quantity of zero', stored(full({ quantity: 0 }))],
    ['a quantity above the limit', stored(full({ quantity: 11 }))],
    ['a fractional quantity', stored(full({ quantity: 1.5 }))],
    ['a quantity as text', stored(full({ quantity: '2' }))],
    ['a variant with markup', stored(full({ variantId: '<script>alert(1)</script>' }))],
    ['a variant that is not text', stored(full({ variantId: { $ne: '' } }))],
    ['a customer name that is not text', stored(full({ customer: { name: 5, email: 'a@b.co' } }))],
    ['a customer that is not an object', stored(full({ customer: 'Ana' }))],
    ['a very long name', stored(full({ customer: { name: 'x'.repeat(301), email: 'a@b.co' } }))],
    [
      'a control character in the address',
      stored(
        full({ delivery: { recipientName: 'a', address: 'a\u0000b', city: 'c', phone: '1' } }),
      ),
    ],
    ['terms as text', stored(full({ accepted: { terms: 'yes', personalData: true } }))],
    [
      'a card token with spaces',
      stored(full({ card: { token: 'tok test', brand: 'visa', last4: '4242', at: NOW } })),
    ],
    [
      'a card that looks like a number',
      stored(
        full({
          card: { token: 'tok_test_123456', brand: 'visa', last4: '4242424242424242', at: NOW },
        }),
      ),
    ],
    [
      'an unknown brand',
      stored(full({ card: { token: 'tok_test_123456', brand: 'amex', last4: '4242', at: NOW } })),
    ],
    [
      'a card time that is text',
      stored(full({ card: { token: 'tok_test_123456', brand: 'visa', last4: '4242', at: 'now' } })),
    ],
    ['a key with spaces', stored(full({ idempotencyKey: 'key with spaces' }))],
    ['an order id with markup', stored(full({ orderId: '<b>1</b>' }))],
    ['an oversized value', stored(full({ customer: { name: 'x'.repeat(5_000), email: 'a' } }))],
  ])('ignores %s, so an edited storage never shows anything wrong', (_label, raw) => {
    expect(loadPersisted(memory(raw), NOW)).toBeUndefined();
  });

  it('survives storage that throws, as in a private window', () => {
    const broken = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(loadPersisted(broken, NOW)).toBeUndefined();
    expect(() => savePersisted(broken, initialCheckout)).not.toThrow();
  });

  it('works without any storage', () => {
    expect(loadPersisted(null, NOW)).toBeUndefined();
    expect(() => savePersisted(null, initialCheckout)).not.toThrow();
  });
});
