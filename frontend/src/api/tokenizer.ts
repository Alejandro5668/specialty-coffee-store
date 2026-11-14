import { CardBrand } from './types';

export type CardInput = {
  number: string;
  cvc: string;
  expMonth: string;
  expYear: string;
  holder: string;
};
export type TokenizedCard = { token: string; brand: CardBrand; last4: string };
export type TokenizeField = 'number' | 'cvc' | 'expiry' | 'holder';

/** Carries only a message for the shopper and the field to point at, never the card data. */
export class TokenizeError extends Error {
  constructor(
    message: string,
    readonly field: TokenizeField | null,
  ) {
    super(message);
  }
}

export interface CardTokenizer {
  tokenize(card: CardInput): Promise<TokenizedCard>;
}

const TIMEOUT_MS = 10_000;
const NOW_MESSAGE = 'We could not check the card right now. Try again in a minute.';
const NETWORK_MESSAGE =
  'We could not reach the payment service. Check your connection and try again.';
const GENERAL_MESSAGE = 'We could not check the card. Review it or use another card.';

const FIELD_MESSAGES: Record<TokenizeField, string> = {
  number: 'This card number is not accepted. Check it or use another card.',
  cvc: 'Check the 3 digits on the back of the card.',
  expiry: 'Check the expiry date.',
  holder: 'Check the name on the card.',
};
/** The service's own field names, in the order they should be shown. */
const SERVICE_FIELDS: Array<[string, TokenizeField]> = [
  ['number', 'number'],
  ['cvc', 'cvc'],
  ['exp_month', 'expiry'],
  ['exp_year', 'expiry'],
  ['card_holder', 'holder'],
];

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const toBrand = (value: unknown): CardBrand =>
  value === 'VISA' ? 'visa' : value === 'MASTERCARD' ? 'mastercard' : 'unknown';

const refusal = (answer: unknown): TokenizeError => {
  const messages = isObject(answer) && isObject(answer.error) ? answer.error.messages : null;
  if (!isObject(messages)) return new TokenizeError(NOW_MESSAGE, null);
  const named = SERVICE_FIELDS.find(([name]) => name in messages);
  return named
    ? new TokenizeError(FIELD_MESSAGES[named[1]], named[1])
    : new TokenizeError(GENERAL_MESSAGE, null);
};

/**
 * Talks to the payment service straight from the browser with the public key, so the card number
 * and the security code never pass through our servers. Nothing here logs or keeps them.
 */
export const createCardTokenizer = (
  baseUrl: string,
  publicKey: string,
  fetchFn: typeof fetch,
): CardTokenizer => ({
  async tokenize(card) {
    let response: Response;
    try {
      response = await fetchFn(`${baseUrl.replace(/\/+$/, '')}/tokens/cards`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          number: card.number,
          cvc: card.cvc,
          exp_month: card.expMonth,
          exp_year: card.expYear,
          card_holder: card.holder,
        }),
        credentials: 'omit',
        cache: 'no-store',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new TokenizeError(NETWORK_MESSAGE, null);
    }

    const answer: unknown = await response.json().catch(() => null);
    if (!response.ok)
      throw response.status === 422 ? refusal(answer) : new TokenizeError(NOW_MESSAGE, null);

    const data = isObject(answer) ? answer.data : null;
    if (
      !isObject(data) ||
      typeof data.id !== 'string' ||
      !/^tok_[A-Za-z0-9_]{6,100}$/.test(data.id) ||
      typeof data.last_four !== 'string' ||
      !/^\d{4}$/.test(data.last_four)
    ) {
      throw new TokenizeError(NOW_MESSAGE, null);
    }
    return { token: data.id, brand: toBrand(data.brand), last4: data.last_four };
  },
});

/** Used when the payment settings are missing, so the form says so instead of failing in a strange way. */
export const unavailableTokenizer: CardTokenizer = {
  async tokenize() {
    throw new TokenizeError('Payments are not set up in this environment.', null);
  },
};
