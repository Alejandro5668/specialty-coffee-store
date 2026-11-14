import { CheckoutState } from './checkoutSlice';

export const PERSIST_KEY = 'coffee-store:v1';
const VERSION = 1;
const MAX_QUANTITY = 10;
const MAX_RAW_LENGTH = 1_000;
const VARIANT_ID = /^[a-z0-9-]{1,80}$/;

export type Persisted = { checkout: CheckoutState };
type Reader = Pick<Storage, 'getItem'>;
type Writer = Pick<Storage, 'setItem'>;

/**
 * Only the selection is saved. Prices and amounts are never stored: they come fresh from the API
 * every time, so an edited storage cannot show a wrong amount.
 */
const isValid = (value: unknown): value is Persisted => {
  if (typeof value !== 'object' || value === null) return false;
  const checkout = (value as Record<string, unknown>).checkout as
    Record<string, unknown> | undefined;
  if (typeof checkout !== 'object' || checkout === null) return false;
  const { variantId, quantity } = checkout;
  const variantOk =
    variantId === null || (typeof variantId === 'string' && VARIANT_ID.test(variantId));
  const quantityOk =
    Number.isInteger(quantity) && (quantity as number) >= 1 && (quantity as number) <= MAX_QUANTITY;
  return variantOk && quantityOk;
};

export const loadPersisted = (storage: Reader | null): Persisted | undefined => {
  try {
    const raw = storage?.getItem(PERSIST_KEY);
    if (!raw || raw.length > MAX_RAW_LENGTH) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      (parsed as { v?: unknown }).v !== VERSION
    ) {
      return undefined;
    }
    if (!isValid(parsed)) return undefined;
    const { variantId, quantity } = parsed.checkout;
    return { checkout: { variantId, quantity } };
  } catch {
    return undefined;
  }
};

export const savePersisted = (storage: Writer | null, state: Persisted): void => {
  try {
    const { variantId, quantity } = state.checkout;
    storage?.setItem(
      PERSIST_KEY,
      JSON.stringify({ v: VERSION, checkout: { variantId, quantity } }),
    );
  } catch {
    // A full or blocked storage only costs the refresh recovery, never the purchase.
  }
};
