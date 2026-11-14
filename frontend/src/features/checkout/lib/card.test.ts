import {
  detectBrand,
  digitsOnly,
  formatCardNumber,
  formatExpiry,
  luhnValid,
  splitExpiry,
  validateCardNumber,
  validateCvc,
  validateExpiry,
  validateHolder,
} from './card';

describe('luhnValid', () => {
  it.each([
    '4242424242424242',
    '4111111111111111',
    '5555555555554444',
    '5105105105105100',
    '2223003122003222',
  ])('accepts the real test number %s', (n) => expect(luhnValid(n)).toBe(true));
  it.each(['4242424242424241', '1234567812345678', '0000000000000001', '', '4'])(
    'rejects %p',
    (n) => expect(luhnValid(n)).toBe(false),
  );
});

describe('detectBrand', () => {
  it.each([
    ['4', 'visa'],
    ['4242', 'visa'],
    ['51', 'mastercard'],
    ['55', 'mastercard'],
    ['2221', 'mastercard'],
    ['2720', 'mastercard'],
    ['2500', 'mastercard'],
  ])('%s is %s', (prefix, brand) => expect(detectBrand(prefix)).toBe(brand));

  it.each(['', '5', '50', '56', '6', '3', '22', '222', '2220', '2721', '9999'])(
    '%p is not a brand we accept',
    (p) => expect(detectBrand(p)).toBe('unknown'),
  );
});

describe('formatting', () => {
  it('keeps only digits and groups the card number by four', () => {
    expect(digitsOnly('4242-4242 4242.4242abc')).toBe('4242424242424242');
    expect(formatCardNumber('4242424242424242')).toBe('4242 4242 4242 4242');
    expect(formatCardNumber('42 4a2')).toBe('4242');
  });

  it('never lets the card number grow beyond 19 digits', () => {
    expect(digitsOnly(formatCardNumber('1'.repeat(40)))).toHaveLength(19);
  });

  it.each([
    ['', ''],
    ['1', '1'],
    ['12', '12'],
    ['123', '12 / 3'],
    ['1230', '12 / 30'],
    ['12/30', '12 / 30'],
    ['12 / 3099', '12 / 30'],
    ['ab', ''],
  ])('writes the expiry %p as %p', (raw, text) => expect(formatExpiry(raw)).toBe(text));
});

describe('validateCardNumber', () => {
  it.each(['4242 4242 4242 4242', '5555 5555 5555 4444', '4111111111111111'])('accepts %s', (n) =>
    expect(validateCardNumber(n)).toBeNull(),
  );

  it('asks for the number when it is empty', () => {
    expect(validateCardNumber('')).toBe('Enter the card number.');
    expect(validateCardNumber('   ')).toBe('Enter the card number.');
  });

  it.each(['4242', '4242 4242 4242 4241', '4242 4242 4242 42424'])(
    'says %p does not look valid',
    (n) => expect(validateCardNumber(n)).toBe('Check the card number: it does not look valid.'),
  );

  it('only accepts Visa and Mastercard, and says so', () => {
    expect(validateCardNumber('3782 8224 6310 005')).toBe('We accept Visa and Mastercard.');
    expect(validateCardNumber('6011 1111 1111 1117')).toBe('We accept Visa and Mastercard.');
  });

  it.each(['<script>alert(1)</script>', "4242'; DROP TABLE", '４２４２'])(
    'never accepts hostile input %p',
    (n) => expect(validateCardNumber(n)).not.toBeNull(),
  );
});

describe('validateExpiry', () => {
  const now = new Date(2026, 10, 14); // November 2026

  it.each(['11 / 26', '12 / 26', '01 / 27', '11 / 46', '1126'])('accepts %s', (e) =>
    expect(validateExpiry(e, now)).toBeNull(),
  );

  it('asks for a complete date', () => {
    for (const e of ['', '1', '12', '12 / 3', 'ab']) {
      expect(validateExpiry(e, now)).toBe('Enter the expiry date as MM / YY.');
    }
  });

  it.each(['00 / 30', '13 / 30', '99 / 30'])('rejects the month in %s', (e) =>
    expect(validateExpiry(e, now)).toBe('Enter the expiry date as MM / YY.'),
  );

  it.each(['10 / 26', '12 / 25', '01 / 20'])('says %s has expired', (e) =>
    expect(validateExpiry(e, now)).toBe('This card has expired. Use another card.'),
  );

  it('rejects a year that is too far away to be real', () => {
    expect(validateExpiry('12 / 60', now)).toBe('Check the expiry year.');
  });
});

describe('validateCvc', () => {
  it('accepts exactly three digits', () => {
    expect(validateCvc('123')).toBeNull();
    expect(validateCvc('000')).toBeNull();
  });
  it.each(['', '12', '1234', 'abc', '12a', ' 12 '])('rejects %p', (c) =>
    expect(validateCvc(c)).toBe('Enter the 3 digits on the back of the card.'),
  );
});

describe('validateHolder', () => {
  it.each(['Ana Pérez', 'José María Muñoz', "O'Brien-Smith Jr."])('accepts %s', (h) =>
    expect(validateHolder(h)).toBeNull(),
  );
  it('needs at least five characters, because the payment service requires it', () => {
    expect(validateHolder('Ana')).toBe(
      'Enter the name as it appears on the card (at least 5 characters).',
    );
    expect(validateHolder('')).toBe(
      'Enter the name as it appears on the card (at least 5 characters).',
    );
  });
  it.each([
    'Ana <b>Pérez</b>',
    'Ana1234 Pérez',
    'Ana\u0000Pérez',
    'x'.repeat(101),
    '<script>alert(1)</script>',
  ])('rejects %p', (h) => expect(validateHolder(h)).not.toBeNull());
});

describe('splitExpiry', () => {
  it.each([
    ['12 / 30', { expMonth: '12', expYear: '30' }],
    ['0127', { expMonth: '01', expYear: '27' }],
    ['1/30', null],
    ['', null],
  ])('reads %p', (raw, parts) => expect(splitExpiry(raw)).toEqual(parts));
});
