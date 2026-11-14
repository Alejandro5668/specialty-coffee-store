/** jsdom has no Response, and the clients only need these three members. */
export const reply = (status: number, read: () => Promise<unknown>) =>
  ({ ok: status >= 200 && status < 300, status, json: read }) as unknown as Response;
export const json = (status: number, body: unknown) => reply(status, async () => body);
export const html = (status: number) =>
  reply(status, async () => {
    throw new SyntaxError('Unexpected token <');
  });

export type Call = { url: string; init: RequestInit };
export const recordFetch = (respond: () => Response | Promise<Response>) => {
  const calls: Call[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return respond();
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
};
