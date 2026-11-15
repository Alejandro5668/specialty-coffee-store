import { CARDS } from '../support/data';
import { expect, pay, reachSummary, test } from '../support/fixtures';

test.describe('time', () => {
  test('after an approved payment the page returns to the coffees by itself, with the new stock', async ({
    page,
    backend,
  }) => {
    void backend;
    await page.clock.install();
    await reachSummary(page, CARDS.approved);
    await pay(page);
    await expect(page.getByRole('heading', { name: 'Pago aprobado' })).toBeVisible();
    await expect(page.getByRole('timer')).toContainText('Volviendo a los cafés en');
    await page.clock.runFor(9_000);
    await expect(page.getByRole('heading', { name: 'Cafés' })).toBeVisible();
    await expect(page.locator('article').first()).toContainText('19 disponibles');
  });

  test('after a declined card the page waits longer, so there is time to read what to do', async ({
    page,
    backend,
  }) => {
    await page.clock.install();
    await reachSummary(page, CARDS.declined);
    await pay(page);
    await expect(page.getByRole('heading', { name: 'Tu tarjeta fue rechazada' })).toBeVisible();
    await expect(page.getByRole('timer')).toContainText('Volviendo a los cafés en 20 segundos.');
    // Past the 8 seconds of an approved payment, the shopper is still on the result.
    await page.clock.runFor(9_000);
    await expect(page.getByRole('heading', { name: 'Tu tarjeta fue rechazada' })).toBeVisible();
    await page.clock.runFor(12_000);
    await expect(page.getByRole('heading', { name: 'Cafés' })).toBeVisible();
    // The details are kept for another try, and the stock went back.
    expect(backend.stockOf('huila-washed-250')).toBe(20);
  });

  test('the shopper can stay on the result page and the countdown stops', async ({
    page,
    backend,
  }) => {
    void backend;
    await page.clock.install();
    await reachSummary(page, CARDS.approved);
    await pay(page);
    await page.getByRole('button', { name: 'Quedarme en esta página' }).click();
    await page.clock.runFor(20_000);
    await expect(page.getByRole('heading', { name: 'Pago aprobado' })).toBeVisible();
  });

  test('a slow catalog shows that it is loading instead of an empty page', async ({
    page,
    backend,
  }) => {
    void backend;
    // The request is held until the test lets it go, so nothing depends on a timer.
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route(
      (url) => url.pathname === '/api/products',
      async (route) => {
        await held;
        await route.fallback();
      },
    );
    await page.goto('/');
    try {
      await expect(page.getByText('Cargando cafés')).toBeVisible();
      await expect(page.locator('article')).toHaveCount(0);
    } finally {
      release();
    }
    await expect(page.locator('article')).toHaveCount(2);
  });
});
