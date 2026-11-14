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

describe('recipient name (optional)', () => {
  it('accepts a name and also an empty value, because the order then goes to the buyer', () => {
    expect(validateRecipient('Ana Pérez')).toBeNull();
    expect(validateRecipient('')).toBeNull();
    expect(validateRecipient('   ')).toBeNull();
  });

  it('still refuses markup and values that are too long', () => {
    expect(validateRecipient('<b>x</b>')).toBe('Quita los caracteres especiales, como < o >.');
    expect(validateRecipient('a'.repeat(201))).toBe('Usa 200 caracteres o menos.');
  });
});

describe('text fields', () => {
  it.each([
    [validateFullName, 'Ana Pérez', 'Ingresa tu nombre completo.'],
    [validateAddress, 'Calle 10 # 5-20, Apto 301', 'Ingresa la dirección de entrega.'],
    [validateCity, 'Medellín', 'Ingresa la ciudad.'],
  ])('%p accepts a normal value and asks for it when empty', (validate, good, required) => {
    expect(validate(good)).toBeNull();
    expect(validate('')).toBe(required);
    expect(validate('   ')).toBe(required);
  });

  it.each(hostile)('refuses markup and control characters: %p', (value) => {
    for (const validate of [validateFullName, validateRecipient, validateAddress, validateCity]) {
      expect(validate(value)).toBe('Quita los caracteres especiales, como < o >.');
    }
  });

  it('limits the length the same way the server does', () => {
    expect(validateFullName('x'.repeat(100))).toBeNull();
    expect(validateFullName('x'.repeat(101))).toBe('Usa 100 caracteres o menos.');
    expect(validateAddress('x'.repeat(200))).toBeNull();
    expect(validateAddress('x'.repeat(201))).toBe('Usa 200 caracteres o menos.');
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
    expect(validateEmail(e)).toBe('Ingresa un correo válido, como ana@example.com.'),
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
    (p) => expect(validatePhone(p)).toBe('Ingresa un teléfono de 7 a 15 dígitos.'),
  );
});
