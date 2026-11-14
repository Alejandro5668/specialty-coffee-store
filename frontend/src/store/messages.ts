import { ApiError } from '../api/client';

export const FALLBACK = 'Algo salió mal. Inténtalo de nuevo en un minuto.';

/** Only messages written for shoppers reach the screen, never a raw error from the code. */
export const messageOf = (error: unknown): string =>
  error instanceof ApiError ? error.message : FALLBACK;
