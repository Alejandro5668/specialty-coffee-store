import { CARDS } from '../support/data';
import { checkouts } from '../support/calls';
import { expect, pay, reachSummary, test } from '../support/fixtures';

test.describe('double submit and interrupted payments', () => {
  test('a double click on Pay creates one order and one charge', async ({ page, backend }) => {
    await reachSummary(page, CARDS.approved);
    await page.getByRole('button', { name: /^Pagar \$/ }).dblclick();
    await expect(page.getByRole('heading', { name: 'Pago aprobado' })).toBeVisible();
    expect(checkouts(backend.calls)).toHaveLength(1);
    expect(backend.orders.size).toBe(1);
    expect(backend.stockOf('huila-washed-250')).toBe(19);
  });

  test('two clicks in the same instant, before the button can turn off, still send one order', async ({
    page,
    backend,
  }) => {
    await reachSummary(page, CARDS.approved);
    // Both clicks run in one task: the page has not repainted the disabled button in between.
    await page.getByRole('button', { name: /^Pagar \$/ }).evaluate((button: HTMLElement) => {
      button.click();
      button.click();
    });
    await expect(page.getByRole('heading', { name: 'Pago aprobado' })).toBeVisible();
    expect(checkouts(backend.calls)).toHaveLength(1);
    expect(backend.stockOf('huila-washed-250')).toBe(19);
  });

  test('a refresh in the middle of the payment never creates a second order', async ({
    page,
    backend,
  }) => {
    backend.responseDelayMs = 2_000;
    await reachSummary(page, CARDS.approved);
    await pay(page);
    await expect.poll(() => checkouts(backend.calls).length).toBe(1);
    await page.reload();
    backend.responseDelayMs = 0;
    await pay(page);
    await expect(page.getByRole('heading', { name: 'Pago aprobado' })).toBeVisible();
    // The second attempt carried the same idempotency key, so the server answered with the first order.
    expect(backend.orders.size).toBe(1);
    expect(backend.stockOf('huila-washed-250')).toBe(19);
  });

  test('a dropped connection says the shopper will not be charged twice, and retrying works', async ({
    page,
    backend,
  }) => {
    await reachSummary(page, CARDS.approved);
    await page.route('**/api/checkout', (route) =>
      route.request().method() === 'POST' ? route.abort() : route.fallback(),
    );
    await pay(page);
    await expect(page.getByRole('alert')).toContainText(
      'No pudimos confirmar tu pedido. Pulsa Pagar de nuevo: no se te cobrará dos veces.',
    );
    await page.unroute('**/api/checkout');
    await pay(page);
    await expect(page.getByRole('heading', { name: 'Pago aprobado' })).toBeVisible();
    expect(backend.orders.size).toBe(1);
  });

  test('the last unit bought by someone else meanwhile is refused plainly, with no charge', async ({
    page,
    backend,
  }) => {
    await reachSummary(page, CARDS.approved);
    backend.products[0].variants[0].stock = 0;
    await pay(page);
    await expect(page.getByRole('alert')).toContainText(
      'No hay stock suficiente para esa cantidad. Elige menos unidades.',
    );
    expect(backend.orders.size).toBe(0);
  });

  test('a flood answer is shown as a plain message, never the library text', async ({
    page,
    backend,
  }) => {
    backend.tooManyRequests = true;
    await reachSummary(page, CARDS.approved);
    await pay(page);
    await expect(page.getByRole('alert')).toContainText(
      'Demasiadas peticiones. Espera un minuto e inténtalo de nuevo.',
    );
    await expect(page.locator('body')).not.toContainText(/ThrottlerException|Too Many/i);
  });
});
