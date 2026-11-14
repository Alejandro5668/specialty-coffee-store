export type CardBrand = 'visa' | 'mastercard' | 'unknown';

const MAX_DIGITS = 19;
const LENGTHS: Record<Exclude<CardBrand, 'unknown'>, number[]> = {
  visa: [13, 16, 19],
  mastercard: [16],
};

export const digitsOnly = (value: string): string => value.replace(/\D/g, '');

export const luhnValid = (digits: string): boolean => {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) n = n * 2 > 9 ? n * 2 - 9 : n * 2;
    sum += n;
  }
  return sum % 10 === 0;
};

/** Visa starts with 4. Mastercard is 51-55 or 2221-2720. Anything else is not accepted. */
export const detectBrand = (digits: string): CardBrand => {
  if (/^4/.test(digits)) return 'visa';
  if (/^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d\d|27[01]\d|2720)/.test(digits)) return 'mastercard';
  return 'unknown';
};

export const formatCardNumber = (raw: string): string =>
  (
    digitsOnly(raw)
      .slice(0, MAX_DIGITS)
      .match(/.{1,4}/g) ?? []
  ).join(' ');

export const formatExpiry = (raw: string): string => {
  const digits = digitsOnly(raw).slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)} / ${digits.slice(2)}`;
};

export const validateCardNumber = (raw: string): string | null => {
  const digits = digitsOnly(raw);
  if (digits.length === 0) return 'Enter the card number.';
  const brand = detectBrand(digits);
  if (brand === 'unknown') return 'We accept Visa and Mastercard.';
  if (!LENGTHS[brand].includes(digits.length) || !luhnValid(digits)) {
    return 'Check the card number: it does not look valid.';
  }
  return null;
};

const MAX_YEARS_AHEAD = 20;

/** The payment service does not check the expiry, so this form does. */
export const validateExpiry = (raw: string, now: Date): string | null => {
  const digits = digitsOnly(raw);
  const invalid = 'Enter the expiry date as MM / YY.';
  if (digits.length !== 4) return invalid;
  const month = Number(digits.slice(0, 2));
  const year = 2000 + Number(digits.slice(2));
  if (month < 1 || month > 12) return invalid;
  if (year * 12 + month < now.getFullYear() * 12 + now.getMonth() + 1) {
    return 'This card has expired. Use another card.';
  }
  if (year > now.getFullYear() + MAX_YEARS_AHEAD) return 'Check the expiry year.';
  return null;
};

export const validateCvc = (raw: string): string | null =>
  /^\d{3}$/.test(raw) ? null : 'Enter the 3 digits on the back of the card.';

/** The payment service needs at least five characters here. */
export const validateHolder = (raw: string): string | null => {
  const name = raw.trim();
  if (name.length < 5) return 'Enter the name as it appears on the card (at least 5 characters).';
  if (name.length > 100) return 'Use 100 characters or fewer.';
  if (!/^\p{L}[\p{L} .'-]*$/u.test(name)) return "Use only letters, spaces and . - ' in the name.";
  return null;
};
