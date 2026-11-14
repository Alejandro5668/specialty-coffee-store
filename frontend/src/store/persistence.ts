import { CheckoutState, initialCheckout, isCardFresh } from './checkoutState';

export const PERSIST_KEY = 'coffee-store:v2';
const VERSION = 2;
const MAX_QUANTITY = 10;
const MAX_RAW_LENGTH = 4_000;
const MAX_TEXT = 300;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001F\u007F]/;

export type Persistable = Omit<CheckoutState, 'placing' | 'placeError'>;
type Reader = Pick<Storage, 'getItem'>;
type Writer = Pick<Storage, 'setItem'>;
type Json = Record<string, unknown>;

/** Field by field, so nothing else in the state can ever end up in storage. */
export const toPersistable = (s: CheckoutState): Persistable => ({
  variantId: s.variantId,
  quantity: s.quantity,
  customer: { name: s.customer.name, email: s.customer.email },
  delivery: {
    recipientName: s.delivery.recipientName,
    address: s.delivery.address,
    city: s.delivery.city,
    phone: s.delivery.phone,
  },
  accepted: { terms: s.accepted.terms, personalData: s.accepted.personalData },
  card: s.card
    ? { token: s.card.token, brand: s.card.brand, last4: s.card.last4, at: s.card.at }
    : null,
  idempotencyKey: s.idempotencyKey,
  orderId: s.orderId,
});

const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= MAX_TEXT && !CONTROL.test(v);
const matches = (v: unknown, pattern: RegExp): v is string =>
  typeof v === 'string' && pattern.test(v);
const orNull = (v: unknown, pattern: RegExp): boolean => v === null || matches(v, pattern);

/** Strict on purpose: anything odd (an edited storage, an old version) means starting from scratch. */
const parse = (value: unknown): Persistable | null => {
  if (!isObject(value)) return null;
  const { customer, delivery, accepted, card } = value;
  if (!orNull(value.variantId, /^[a-z0-9-]{1,80}$/)) return null;
  if (
    !Number.isInteger(value.quantity) ||
    (value.quantity as number) < 1 ||
    (value.quantity as number) > MAX_QUANTITY
  )
    return null;
  if (!isObject(customer) || !isText(customer.name) || !isText(customer.email)) return null;
  if (
    !isObject(delivery) ||
    !['recipientName', 'address', 'city', 'phone'].every((k) => isText(delivery[k]))
  )
    return null;
  if (
    !isObject(accepted) ||
    typeof accepted.terms !== 'boolean' ||
    typeof accepted.personalData !== 'boolean'
  )
    return null;
  if (!orNull(value.idempotencyKey, /^[A-Za-z0-9_-]{8,100}$/)) return null;
  if (!orNull(value.orderId, /^[A-Za-z0-9-]{1,100}$/)) return null;
  if (card !== null) {
    if (
      !isObject(card) ||
      !matches(card.token, /^tok_[A-Za-z0-9_]{6,100}$/) ||
      !matches(card.last4, /^\d{4}$/)
    )
      return null;
    if (!['visa', 'mastercard', 'unknown'].includes(card.brand as string)) return null;
    if (!Number.isSafeInteger(card.at) || (card.at as number) <= 0) return null;
  }
  return toPersistable({ ...initialCheckout, ...(value as unknown as Persistable) });
};

export const loadPersisted = (
  storage: Reader | null,
  now: number,
): { checkout: CheckoutState } | undefined => {
  try {
    const raw = storage?.getItem(PERSIST_KEY);
    if (!raw || raw.length > MAX_RAW_LENGTH) return undefined;
    const saved: unknown = JSON.parse(raw);
    if (!isObject(saved) || saved.v !== VERSION) return undefined;
    const checkout = parse(saved.checkout);
    if (!checkout) return undefined;
    // A stale token is useless, and the key that went with it belonged to that attempt.
    const stale = checkout.card !== null && !isCardFresh(checkout.card, now);
    return {
      checkout: {
        ...initialCheckout,
        ...checkout,
        card: stale ? null : checkout.card,
        idempotencyKey: stale ? null : checkout.idempotencyKey,
      },
    };
  } catch {
    return undefined;
  }
};

export const savePersisted = (storage: Writer | null, state: CheckoutState): void => {
  try {
    storage?.setItem(PERSIST_KEY, JSON.stringify({ v: VERSION, checkout: toPersistable(state) }));
  } catch {
    // A full or blocked storage only costs the refresh recovery, never the purchase.
  }
};
