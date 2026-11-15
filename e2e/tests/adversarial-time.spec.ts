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
    await page.route(
      (url) => url.pathname === '/api/products',
      async (route) => {
        await new Promise((r) => setTimeout(r, 1_200));
        await route.fallback();
      },
    );
    await page.goto('/');
    await expect(page.getByText('Cargando cafés')).toBeVisible();
    await expect(page.locator('article')).toHaveCount(2);
  });
});
