import { loadPersisted, PERSIST_KEY, savePersisted } from './persistence';

const memory = (initial?: string) => {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(PERSIST_KEY, initial);
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
};
const stored = (checkout: unknown, v: unknown = 1) => JSON.stringify({ v, checkout });

describe('persistence', () => {
  it('round-trips the selection', () => {
    const storage = memory();
    savePersisted(storage, { checkout: { variantId: 'huila-washed-250', quantity: 3 } });
    expect(loadPersisted(storage)).toEqual({
      checkout: { variantId: 'huila-washed-250', quantity: 3 },
    });
  });

  it('stores only the selection, never prices or amounts', () => {
    const storage = memory();
    savePersisted(storage, { checkout: { variantId: 'huila-washed-250', quantity: 3 } });
    expect(storage.data.get(PERSIST_KEY)).toBe(
      '{"v":1,"checkout":{"variantId":"huila-washed-250","quantity":3}}',
    );
  });

  it('starts empty when nothing was saved', () => {
    expect(loadPersisted(memory())).toBeUndefined();
  });

  it.each([
    ['text that is not JSON', 'not json {'],
    ['JSON that is not an object', '"hello"'],
    ['null', 'null'],
    ['an old or unknown version', stored({ variantId: 'a', quantity: 1 }, 2)],
    ['no checkout', JSON.stringify({ v: 1 })],
    ['a quantity of zero', stored({ variantId: 'a', quantity: 0 })],
    ['a negative quantity', stored({ variantId: 'a', quantity: -4 })],
    ['a fractional quantity', stored({ variantId: 'a', quantity: 1.5 })],
    ['a quantity above the limit', stored({ variantId: 'a', quantity: 11 })],
    ['a quantity as text', stored({ variantId: 'a', quantity: '2' })],
    ['a variant with markup', stored({ variantId: '<script>alert(1)</script>', quantity: 1 })],
    ['a variant that is not text', stored({ variantId: { $ne: '' }, quantity: 1 })],
    ['an oversized value', stored({ variantId: 'a'.repeat(5_000), quantity: 1 })],
  ])('ignores %s, so an edited storage never shows anything wrong', (_label, raw) => {
    expect(loadPersisted(memory(raw))).toBeUndefined();
  });

  it('accepts an empty selection', () => {
    expect(loadPersisted(memory(stored({ variantId: null, quantity: 1 })))).toEqual({
      checkout: { variantId: null, quantity: 1 },
    });
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
    expect(loadPersisted(broken)).toBeUndefined();
    expect(() =>
      savePersisted(broken, { checkout: { variantId: 'a', quantity: 1 } }),
    ).not.toThrow();
  });

  it('works without any storage', () => {
    expect(loadPersisted(null)).toBeUndefined();
    expect(() => savePersisted(null, { checkout: { variantId: 'a', quantity: 1 } })).not.toThrow();
  });
});
