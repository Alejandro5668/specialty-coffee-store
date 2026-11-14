import { CARDS } from '../support/data';
import { expect, pay, reachSummary, test } from '../support/fixtures';

test.describe('a purchase from the coffees to the result', () => {
  test('an approved payment shows the result, then returns to the coffees with the stock updated', async ({
    page,
    backend,
  }) => {
    await reachSummary(page, CARDS.approved, 1);
    const summary = page.getByRole('dialog', { name: 'Resumen del pedido' });
    // Two units of the first size: $64.000 + base $3.000 + delivery $8.000.
    await expect(summary).toContainText('Huila Lavado, 250 g × 2');
    await expect(summary).toContainText('$64.000');
    await expect(summary).toContainText('$3.000');
    await expect(summary).toContainText('$8.000');
    await expect(summary.getByRole('button', { name: 'Pagar $75.000' })).toBeVisible();

    await pay(page);
    await expect(page.getByRole('heading', { name: 'Pago aprobado' })).toBeVisible();
    await expect(page.getByText('Referencia del pedido: order-1')).toBeVisible();
    expect(backend.stockOf('huila-washed-250')).toBe(18);

    await page.getByRole('button', { name: 'Volver a los cafés' }).click();
    await expect(page.getByRole('heading', { name: 'Cafés' })).toBeVisible();
    await expect(page.locator('article').first()).toContainText('18 disponibles');
  });

  test('a declined card says nothing was charged, gives the stock back and offers another card', async ({
    page,
    backend,
  }) => {
    await reachSummary(page, CARDS.declined);
    await pay(page);
    await expect(page.getByRole('heading', { name: 'Tu tarjeta fue rechazada' })).toBeVisible();
    await expect(page.getByText('No se hizo ningún cobro')).toBeVisible();
    expect(backend.stockOf('huila-washed-250')).toBe(20);

    await page.getByRole('button', { name: 'Probar con otra tarjeta' }).click();
    await expect(page.getByRole('dialog', { name: 'Tarjeta y entrega' })).toBeVisible();
    // The shopper's details are kept; only the spent card is asked for again.
    await expect(page.getByLabel('Nombre completo')).toHaveValue('Ana Perez');
    await expect(page.getByLabel('Número de tarjeta')).toHaveValue('');
  });

  test('a provider failure is explained plainly and the stock is released', async ({
    page,
    backend,
  }) => {
    backend.forceError = true;
    await reachSummary(page, CARDS.approved);
    await pay(page);
    await expect(page.getByRole('heading', { name: 'No pudimos completar el pago' })).toBeVisible();
    expect(backend.stockOf('huila-washed-250')).toBe(20);
  });

  test('a payment that takes long says it is being confirmed, and can be checked again', async ({
    page,
    backend,
  }) => {
    backend.stuckPending = true;
    await reachSummary(page, CARDS.approved);
    await pay(page);
    await expect(page.getByRole('heading', { name: 'Estamos confirmando tu pago' })).toBeVisible();
    // The stock stays reserved while the result is unknown.
    expect(backend.stockOf('huila-washed-250')).toBe(19);

    backend.stuckPending = false;
    backend.settleAfterPolls = 0;
    await expect(page.getByRole('heading', { name: 'Pago aprobado' })).toBeVisible({
      timeout: 15_000,
    });
  });
});
