export type RecordedCall = { method: string; path: string };

/** The POST /checkout requests our API received. */
export const checkouts = (calls: RecordedCall[]) =>
  calls.filter((c) => c.method === 'POST' && c.path === '/checkout');
