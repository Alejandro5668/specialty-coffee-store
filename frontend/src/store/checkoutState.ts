import { CardBrand } from '../api/types';

/** Only what the payment service gave back about the card. The number and the code are never here. */
export type CardSummary = { token: string; brand: CardBrand; last4: string; at: number };

export type CheckoutState = {
  variantId: string | null;
  quantity: number;
  customer: { name: string; email: string };
  delivery: { recipientName: string; address: string; city: string; phone: string };
  accepted: { terms: boolean; personalData: boolean };
  card: CardSummary | null;
  idempotencyKey: string | null;
  orderId: string | null;
  placing: 'idle' | 'placing' | 'failed';
  placeError: string | null;
};

export const initialCheckout: CheckoutState = {
  variantId: null,
  quantity: 1,
  customer: { name: '', email: '' },
  delivery: { recipientName: '', address: '', city: '', phone: '' },
  accepted: { terms: false, personalData: false },
  card: null,
  idempotencyKey: null,
  orderId: null,
  placing: 'idle',
  placeError: null,
};

/** A token is only meant for a quick purchase; after this long the shopper enters the card again. */
export const CARD_TTL_MS = 30 * 60 * 1000;

export const isCardFresh = (card: CardSummary | null, now: number): card is CardSummary =>
  card !== null && now >= card.at && now - card.at <= CARD_TTL_MS;
