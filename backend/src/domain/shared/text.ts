// Rejects markup and control characters instead of trying to sanitize them.
// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[<>\u0000-\u001F\u007F]/;

export const cleanText = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength || FORBIDDEN.test(trimmed)) return null;
  return trimmed;
};
