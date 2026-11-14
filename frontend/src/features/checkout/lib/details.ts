/** Same limits as the server, so the form never accepts what the API would refuse. */
// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[<>\u0000-\u001F\u007F]/;
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const PHONE = /^\+?\d{7,15}$/;

const text = (value: string, max: number, required: string): string | null => {
  const clean = value.trim();
  if (clean.length === 0) return required;
  if (FORBIDDEN.test(clean)) return 'Remove special characters such as < or >.';
  if (clean.length > max) return `Use ${max} characters or fewer.`;
  return null;
};

export const validateFullName = (v: string) => text(v, 100, 'Enter your full name.');
export const validateRecipient = (v: string) =>
  text(v, 200, 'Enter the name of the person who will receive the order.');
export const validateAddress = (v: string) => text(v, 200, 'Enter the delivery address.');
export const validateCity = (v: string) => text(v, 200, 'Enter the city.');

export const validateEmail = (value: string): string | null => {
  const email = value.trim();
  return email.length <= 254 && EMAIL.test(email)
    ? null
    : 'Enter a valid email, like ana@example.com.';
};

/** Spaces, dashes and brackets are fine to type; the server gets only digits and an optional +. */
export const normalizePhone = (raw: string): string => raw.trim().replace(/[\s\-().]/g, '');

export const validatePhone = (raw: string): string | null =>
  PHONE.test(normalizePhone(raw)) ? null : 'Enter a phone number with 7 to 15 digits.';
