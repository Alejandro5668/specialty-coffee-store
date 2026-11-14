import { html, json, recordFetch } from '../test/http';
import { createCardTokenizer, TokenizeError, unavailableTokenizer } from './tokenizer';

const card = {
  number: '4242424242424242',
  cvc: '123',
  expMonth: '12',
  expYear: '30',
  holder: 'Ana Pérez',
};
const ok = {
  status: 'CREATED',
  data: {
    id: 'tok_test_9999_ABC123def456',
    brand: 'VISA',
    last_four: '4242',
    name: 'VISA-4242',
  },
};

const tokenizerWith = (respond: Parameters<typeof recordFetch>[0]) => {
  const { fetchFn, calls } = recordFetch(respond);
  return {
    tokenizer: createCardTokenizer('https://pay.example.test/v1/', 'pub_test_key', fetchFn),
    calls,
  };
};
const failure = async (p: Promise<unknown>): Promise<TokenizeError> => {
  try {
    await p;
  } catch (e) {
    return e as TokenizeError;
  }
  throw new Error('expected a failure');
};
const validation = (messages: Record<string, string[]>) =>
  json(422, { error: { type: 'INPUT_VALIDATION_ERROR', messages } });

describe('tokenize', () => {
  it('sends the card straight to the payment service with the public key, and nowhere else', async () => {
    const { tokenizer, calls } = tokenizerWith(() => json(201, ok));
    await tokenizer.tokenize(card);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://pay.example.test/v1/tokens/cards');
    expect(calls[0].init.method).toBe('POST');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer pub_test_key');
    expect(headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      number: '4242424242424242',
      cvc: '123',
      exp_month: '12',
      exp_year: '30',
      card_holder: 'Ana Pérez',
    });
    expect(calls[0].init.credentials).toBe('omit');
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
  });

  it('returns the token with the brand and the last four digits, and nothing else', async () => {
    const { tokenizer } = tokenizerWith(() => json(201, ok));
    expect(await tokenizer.tokenize(card)).toEqual({
      token: 'tok_test_9999_ABC123def456',
      brand: 'visa',
      last4: '4242',
    });
  });

  it.each([
    ['MASTERCARD', 'mastercard'],
    ['AMEX', 'unknown'],
  ])('maps the brand %s to %s', async (brand, ours) => {
    const { tokenizer } = tokenizerWith(() => json(201, { ...ok, data: { ...ok.data, brand } }));
    expect((await tokenizer.tokenize(card)).brand).toBe(ours);
  });

  it.each([
    ['number', 'number', 'Este número de tarjeta no es aceptado. Revísalo o usa otra tarjeta.'],
    ['cvc', 'cvc', 'Revisa los 3 dígitos del reverso de la tarjeta.'],
    ['exp_month', 'expiry', 'Revisa la fecha de vencimiento.'],
    ['exp_year', 'expiry', 'Revisa la fecha de vencimiento.'],
    ['card_holder', 'holder', 'Revisa el nombre que aparece en la tarjeta.'],
  ])(
    'points at the %s field with a plain message when the service refuses it',
    async (field, mapped, message) => {
      const { tokenizer } = tokenizerWith(() =>
        validation({ [field]: ['mensaje técnico en español'] }),
      );
      const error = await failure(tokenizer.tokenize(card));
      expect(error).toBeInstanceOf(TokenizeError);
      expect(error).toMatchObject({ field: mapped, message });
      expect(error.message).not.toMatch(/mensaje|técnico/);
    },
  );

  it('uses a general message when the refusal does not name a field we know', async () => {
    const { tokenizer } = tokenizerWith(() => validation({ other: ['x'] }));
    expect(await failure(tokenizer.tokenize(card))).toMatchObject({
      field: null,
      message: 'No pudimos verificar la tarjeta. Revísala o usa otra.',
    });
  });

  it.each([500, 502, 503])('is plain about a %s', async (status) => {
    const { tokenizer } = tokenizerWith(() => html(status));
    expect(await failure(tokenizer.tokenize(card))).toMatchObject({
      field: null,
      message: 'No pudimos verificar la tarjeta en este momento. Inténtalo de nuevo en un minuto.',
    });
  });

  it('is plain about a network failure', async () => {
    const { tokenizer } = tokenizerWith(() => Promise.reject(new TypeError('Failed to fetch')));
    expect(await failure(tokenizer.tokenize(card))).toMatchObject({
      field: null,
      message:
        'No pudimos conectar con el servicio de pagos. Revisa tu conexión e inténtalo de nuevo.',
    });
  });

  it.each([
    ['no token', { ...ok, data: { ...ok.data, id: undefined } }],
    ['a token with a strange shape', { ...ok, data: { ...ok.data, id: 'not a token!' } }],
    ['no last four digits', { ...ok, data: { ...ok.data, last_four: undefined } }],
    ['last four that are not digits', { ...ok, data: { ...ok.data, last_four: '42a2' } }],
    ['text', 'hello'],
  ])('refuses a success answer with %s', async (_label, body) => {
    const { tokenizer } = tokenizerWith(() => json(201, body));
    expect(await failure(tokenizer.tokenize(card))).toMatchObject({ field: null });
  });

  it('never puts the card number or the security code in an error, whatever went wrong', async () => {
    const responses = [
      () => validation({ number: ['x'] }),
      () => html(500),
      () => Promise.reject(new TypeError(`Failed to fetch 4242424242424242 123`)),
      () => json(201, { nothing: true }),
    ];
    for (const respond of responses) {
      const { tokenizer } = tokenizerWith(respond);
      const error = await failure(tokenizer.tokenize(card));
      const everything = JSON.stringify({
        ...error,
        message: error.message,
        stack: error.stack,
        cause: error.cause,
      });
      expect(everything).not.toContain('4242424242424242');
      expect(everything).not.toMatch(/"?cvc"?:\s*"?123/);
    }
  });
});

describe('unavailableTokenizer', () => {
  it('says plainly that payments are not set up, and never sends anything anywhere', async () => {
    const error = await failure(unavailableTokenizer.tokenize(card));
    expect(error).toBeInstanceOf(TokenizeError);
    expect(error).toMatchObject({
      field: null,
      message: 'Los pagos no están configurados en este entorno.',
    });
  });
});
