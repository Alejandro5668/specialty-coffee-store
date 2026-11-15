import { expect, test } from '@playwright/test';

/** What the deployed API must keep answering; the simulated API in support/ follows the same shape. */
test.describe('the deployed site (read only)', () => {
  test('serves the coffees in Spanish, with prices and stock', async ({ request }) => {
    const response = await request.get('/api/products');
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toBe('no-store');
    const products = await response.json();
    expect(products).toHaveLength(6);
    for (const p of products) {
      expect(p).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        imageUrl: expect.stringMatching(/^\//),
      });
      expect(p.description).not.toMatch(/\b(and|the|with|of)\b/i);
      expect(p.variants.map((v: { sizeGrams: number }) => v.sizeGrams)).toEqual([250, 500]);
      for (const v of p.variants) {
        expect(v).toMatchObject({
          currency: 'COP',
          priceInCents: expect.any(Number),
          stock: expect.any(Number),
        });
        expect(v.stock).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('answers every kind of failure with a code and a plain message in Spanish', async ({
    request,
  }) => {
    const cases = [
      ['GET', '/api/nope', undefined, 404, 'NOT_FOUND'],
      ['GET', '/api/transactions/does-not-exist', undefined, 404, 'TRANSACTION_NOT_FOUND'],
      ['GET', '/api/deliveries/does-not-exist', undefined, 404, 'DELIVERY_NOT_FOUND'],
      ['POST', '/api/checkout', '{bad', 400, 'BAD_REQUEST'],
      ['POST', '/api/checkout', { pad: 'x'.repeat(20_000) }, 413, 'PAYLOAD_TOO_LARGE'],
      ['POST', '/api/webhooks/payments', { event: 'transaction.updated' }, 400, 'MALFORMED_EVENT'],
    ] as const;
    for (const [method, path, body, status, code] of cases) {
      const response = await request.fetch(path, {
        method,
        headers: { 'content-type': 'application/json' },
        data: typeof body === 'string' ? body : body ? JSON.stringify(body) : undefined,
      });
      expect(response.status(), `${method} ${path}`).toBe(status);
      const answer = await response.json();
      expect(answer.code, `${method} ${path}`).toBe(code);
      expect(JSON.stringify(answer)).not.toMatch(/position|Cannot GET|stack|at \w+\.|JSON/i);
      expect(answer.message).toMatch(/[áéíóúñ]|\b(la|el|no|de|un)\b/i);
    }
  });

  test('refuses an event with an invalid signature', async ({ request }) => {
    const event = {
      event: 'transaction.updated',
      data: { transaction: { id: 'x', status: 'APPROVED', amount_in_cents: 1, reference: 'x' } },
      signature: { properties: ['transaction.id'], checksum: 'deadbeef' },
      timestamp: 1,
      sent_at: '2026-01-01T00:00:00Z',
    };
    const response = await request.post('/api/webhooks/payments', { data: event });
    expect(response.status()).toBe(401);
    expect((await response.json()).code).toBe('INVALID_SIGNATURE');
  });

  test('sends the security headers and gives no permission to another origin', async ({
    request,
  }) => {
    const home = await request.get('/');
    const h = home.headers();
    expect(h['strict-transport-security']).toMatch(/max-age=\d+/);
    expect(h['content-security-policy']).toContain("default-src 'self'");
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['permissions-policy']).toBeTruthy();
    expect(h['cross-origin-opener-policy']).toBe('same-origin');
    const foreign = await request.get('/api/products', {
      headers: { origin: 'https://evil.example' },
    });
    expect(foreign.headers()['access-control-allow-origin']).toBeUndefined();
  });

  test('opens on a phone with no horizontal scroll, and the empty form explains what is missing', async ({
    page,
  }) => {
    const posts: string[] = [];
    page.on('request', (r) => r.method() === 'POST' && posts.push(r.url()));
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.locator('article')).toHaveCount(6);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);

    await page
      .locator('article')
      .first()
      .getByRole('button', { name: 'Pagar con tarjeta de crédito' })
      .click();
    await expect(page.getByRole('dialog', { name: 'Tarjeta y entrega' })).toBeVisible();
    await page.getByRole('button', { name: 'Continuar al resumen' }).click();
    await expect(page.getByLabel('Número de tarjeta')).toHaveAccessibleDescription(
      'Ingresa el número de tarjeta.',
    );
    await expect(page.getByLabel('Teléfono')).toHaveAccessibleDescription(
      'Ingresa un teléfono de 7 a 15 dígitos.',
    );
    // Nothing was typed, so nothing was sent anywhere.
    expect(posts).toEqual([]);
  });
});
