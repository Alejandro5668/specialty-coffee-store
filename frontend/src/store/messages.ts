import { ApiError } from '../api/client';

export const FALLBACK = 'Something went wrong. Try again in a minute.';

/** Only messages written for shoppers reach the screen, never a raw error from the code. */
export const messageOf = (error: unknown): string =>
  error instanceof ApiError ? error.message : FALLBACK;
