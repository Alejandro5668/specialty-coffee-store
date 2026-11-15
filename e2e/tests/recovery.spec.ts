import { checkouts } from '../support/calls';
import { CARDS, PERSON } from '../support/data';
import {
  acceptTerms,
  continueToSummary,
  expect,
  fillCard,
  fillDetails,
  pay,
  reachSummary,
  startPurchase,
  test,
} from '../support/fixtures';

const KEY = 'coffee-store:v2';
const stored = (page: import('@playwright/test').Page) =>
  page.evaluate((key) => sessionStorage.getItem(key), KEY);

test.describe('the progress survives a refresh', () => {
  test('on the form: the details come back, the card never does', async ({ page, backend }) => {
    void backend;
    await startPurchase(page);
    await fillCard(page, CARDS.approved);
    await fillDetails(page);
    await acceptTerms(page);
    await page.reload();
    await expect(page.getByRole('dialog', { name: 'Tarjeta y entrega' })).toBeVisible();
    await expect(page.getByLabel('Nombre completo')).toHaveValue(PERSON.name);
    await expect(page.getByLabel('Dirección')).toHaveValue(PERSON.address);
    await expect(page.getByRole('checkbox', { name: /términos y condiciones/ })).toBeChecked();
    await expect(page.getByLabel('Número de tarjeta')).toHaveValue('');
    await expect(page.getByLabel('Código de seguridad')).toHaveValue('');
  });

  test('on the summary: the same order and amount, and it can still be paid', async ({
    page,
    backend,
  }) => {
    await reachSummary(page, CARDS.approved, 1);
    await page.reload();
    const summary = page.getByRole('dialog', { name: 'Resumen del pedido' });
    await expect(summary).toContainText('Huila Lavado, 250 g × 2');
    await expect(summary.getByRole('button', { name: 'Pagar $75.000' })).toBeVisible();
    await expect(summary).toContainText('Visa terminada en 4242');
    await pay(page);
    await expect(page.getByRole('heading', { name: 'Pago aprobado' })).toBeVisible();
    expect(backend.orders.size).toBe(1);
  });

  test('on the result: the same result, read from the order', async ({ page, backend }) => {
    void backend;
    await reachSummary(page, CARDS.approved);
    await pay(page);
    await expect(page.getByRole('heading', { name: 'Pago aprobado' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Pago aprobado' })).toBeVisible();
    await expect(page.getByText('Referencia del pedido: order-1')).toBeVisible();
  });

  test('while the payment is confirmed: keeps asking and ends with the result', async ({
    page,
    backend,
  }) => {
    backend.stuckPending = true;
    await reachSummary(page, CARDS.approved);
    await pay(page);
    await expect(page.getByRole('heading', { name: 'Estamos confirmando tu pago' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Estamos confirmando tu pago' })).toBeVisible();
    backend.stuckPending = false;
    backend.settleAfterPolls = 0;
    await expect(page.getByRole('heading', { name: 'Pago aprobado' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('the back button goes to the form with the details kept', async ({ page, backend }) => {
    void backend;
    await reachSummary(page, CARDS.approved);
    await page.goBack();
    await expect(page.getByRole('dialog', { name: 'Tarjeta y entrega' })).toBeVisible();
    await expect(page.getByLabel('Nombre completo')).toHaveValue(PERSON.name);
    await continueToSummary(page);
  });

  test('an approved purchase forgets everything once the shopper is back at the coffees', async ({
    page,
    backend,
  }) => {
    void backend;
    await reachSummary(page, CARDS.approved);
    await pay(page);
    await page.getByRole('button', { name: 'Volver a los cafés' }).click();
    await page.reload();
    await startPurchase(page);
    await expect(page.getByLabel('Nombre completo')).toHaveValue('');
  });
});

test.describe('a storage edited by hand never shows a wrong amount', () => {
  const draft = (over: Record<string, unknown>) =>
    JSON.stringify({
      v: 2,
      checkout: {
        variantId: 'huila-washed-250',
        quantity: 2,
        customer: { name: PERSON.name, email: PERSON.email },
        delivery: {
          recipientName: '',
          address: PERSON.address,
          city: PERSON.city,
          phone: '3001234567',
        },
        accepted: { terms: true, personalData: true },
        card: null,
        idempotencyKey: null,
        orderId: null,
        ...over,
      },
    });
  const open = async (page: import('@playwright/test').Page, value: string) => {
    await page.addInitScript(([key, raw]) => sessionStorage.setItem(key, raw), [KEY, value]);
    await page.goto('/checkout/summary');
  };

  test('a forged price and total are ignored: the amount to pay comes from the server', async ({
    page,
    backend,
  }) => {
    const card = { token: 'tok_test_APPROVED_9', brand: 'visa', last4: '4242', at: Date.now() };
    await open(
      page,
      draft({ card, priceInCents: 1, totalInCents: 1, amounts: { totalInCents: 1 } }),
    );
    const summary = page.getByRole('dialog', { name: 'Resumen del pedido' });
    // Two units at $32.000, plus the base fee and the delivery: the server's number, not the forged one.
    await expect(summary.getByRole('button', { name: 'Pagar $75.000' })).toBeVisible();
    await pay(page);
    await expect(page.getByRole('heading', { name: 'Pago aprobado' })).toBeVisible();
    expect(checkouts(backend.calls)).toHaveLength(1);
    expect(JSON.stringify(checkouts(backend.calls)[0])).not.toMatch(
      /priceInCents|totalInCents|amounts/,
    );
  });

  const hostile: Array<[string, Record<string, unknown>]> = [
    ['an absurd quantity', { quantity: 9999 }],
    ['a size that does not exist', { variantId: 'does-not-exist' }],
    [
      'markup in the address',
      {
        delivery: {
          recipientName: '',
          address: '<img src=x onerror=alert(1)>',
          city: 'x',
          phone: '3001234567',
        },
      },
    ],
  ];
  for (const [label, over] of hostile) {
    test(`${label} never reaches a payment`, async ({ page, backend }) => {
      await open(page, draft(over));
      await page.waitForLoadState('networkidle');
      expect(backend.calls.filter((c) => c.path === '/checkout')).toHaveLength(0);
      await expect(page.getByRole('button', { name: /^Pagar \$/ })).toHaveCount(0);
    });
  }

  test('a storage that is not JSON starts clean, on the coffees, without breaking the page', async ({
    page,
    backend,
  }) => {
    void backend;
    await open(page, '{ this is not json');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Cafés' })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/Unexpected token|undefined|NaN/);
  });

  test('the stored draft never holds the card number or the security code', async ({
    page,
    backend,
  }) => {
    void backend;
    await startPurchase(page);
    await fillCard(page, CARDS.approved);
    await fillDetails(page);
    await acceptTerms(page);
    await continueToSummary(page);
    const raw = (await stored(page)) ?? '';
    expect(raw).not.toContain(CARDS.approved);
    expect(raw).not.toMatch(/"cvc"|"number"|123"/);
  });
});
