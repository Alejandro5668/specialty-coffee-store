import { CARDS } from '../support/data';
import { expect, pay, reachSummary, test } from '../support/fixtures';

test.describe('card data', () => {
  test('goes only to the payment service: never to our API, a third party or the storage', async ({
    page,
    backend,
  }) => {
    const hosts = new Set<string>();
    page.on('request', (request) => hosts.add(new URL(request.url()).host));
    await reachSummary(page, CARDS.approved);
    await pay(page);
    await expect(page.getByRole('heading', { name: 'Pago aprobado' })).toBeVisible();

    expect([...hosts].sort()).toEqual(['localhost:5174', 'payments.test']);
    expect(backend.providerCalls).toHaveLength(1);
    const ours = backend.apiBodies().join('\n');
    expect(ours).not.toContain(CARDS.approved);
    expect(ours).not.toMatch(/"cvc"|"number"/);
    const storage = await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]));
    expect(storage).not.toContain(CARDS.approved);
  });
});
