/** Same limits as the server, so the form never accepts what the API would refuse. */
// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[<>\u0000-\u001F\u007F]/;
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const PHONE = /^\+?\d{7,15}$/;

const text = (value: string, max: number, required: string): string | null => {
  const clean = value.trim();
  if (clean.length === 0) return required;
  if (FORBIDDEN.test(clean)) return 'Quita los caracteres especiales, como < o >.';
  if (clean.length > max) return `Usa ${max} caracteres o menos.`;
  return null;
};

export const validateFullName = (v: string) => text(v, 100, 'Ingresa tu nombre completo.');
/** Optional: when it is empty the order goes to the buyer (see placeOrder). */
export const validateRecipient = (v: string) => (v.trim() === '' ? null : text(v, 200, ''));
export const validateAddress = (v: string) => text(v, 200, 'Ingresa la dirección de entrega.');
export const validateCity = (v: string) => text(v, 200, 'Ingresa la ciudad.');

export const validateEmail = (value: string): string | null => {
  const email = value.trim();
  return email.length <= 254 && EMAIL.test(email)
    ? null
    : 'Ingresa un correo válido, como ana@example.com.';
};

/** Spaces, dashes and brackets are fine to type; the server gets only digits and an optional +. */
export const normalizePhone = (raw: string): string => raw.trim().replace(/[\s\-().]/g, '');

export const validatePhone = (raw: string): string | null =>
  PHONE.test(normalizePhone(raw)) ? null : 'Ingresa un teléfono de 7 a 15 dígitos.';
