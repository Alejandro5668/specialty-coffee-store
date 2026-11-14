import {
  normalizePhone,
  validateAddress,
  validateCity,
  validateEmail,
  validateFullName,
  validatePhone,
  validateRecipient,
} from './details';

const hostile = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  'a\u0000b',
  'line\nbreak',
  'tab\there',
];

describe('text fields', () => {
  it.each([
    [validateFullName, 'Ana Pérez', 'Enter your full name.'],
    [validateRecipient, 'Ana Pérez', 'Enter the name of the person who will receive the order.'],
    [validateAddress, 'Calle 10 # 5-20, Apto 301', 'Enter the delivery address.'],
    [validateCity, 'Medellín', 'Enter the city.'],
  ])('%p accepts a normal value and asks for it when empty', (validate, good, required) => {
    expect(validate(good)).toBeNull();
    expect(validate('')).toBe(required);
    expect(validate('   ')).toBe(required);
  });

  it.each(hostile)('refuses markup and control characters: %p', (value) => {
    for (const validate of [validateFullName, validateRecipient, validateAddress, validateCity]) {
      expect(validate(value)).toBe('Remove special characters such as < or >.');
    }
  });

  it('limits the length the same way the server does', () => {
    expect(validateFullName('x'.repeat(100))).toBeNull();
    expect(validateFullName('x'.repeat(101))).toBe('Use 100 characters or fewer.');
    expect(validateAddress('x'.repeat(200))).toBeNull();
    expect(validateAddress('x'.repeat(201))).toBe('Use 200 characters or fewer.');
  });
});

describe('validateEmail', () => {
  it.each(['ana@example.com', 'ana.perez+shop@mail.example.co'])('accepts %s', (e) =>
    expect(validateEmail(e)).toBeNull(),
  );
  it.each([
    '',
    'ana',
    'ana@',
    '@example.com',
    'ana@example',
    'a b@example.com',
    'ana@exa mple.com',
    '<a>@b.co',
    `${'a'.repeat(250)}@x.co`,
  ])('rejects %p', (e) =>
    expect(validateEmail(e)).toBe('Enter a valid email, like ana@example.com.'),
  );
});

describe('phone', () => {
  it.each([
    ['300 123 4567', '3001234567'],
    ['+57 300-123-4567', '+573001234567'],
    ['(604) 123 4567', '6041234567'],
  ])('writes %s as %s before sending it', (raw, clean) => {
    expect(normalizePhone(raw)).toBe(clean);
    expect(validatePhone(raw)).toBeNull();
  });

  it.each(['', '123', 'call me', '1'.repeat(16), '+', '57+3001234567', '300 123 45a7'])(
    'rejects %p',
    (p) => expect(validatePhone(p)).toBe('Enter a phone number with 7 to 15 digits.'),
  );
});
