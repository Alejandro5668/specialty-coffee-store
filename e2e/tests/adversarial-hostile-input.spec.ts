import { CARDS, PERSON } from '../support/data';
import { checkouts } from '../support/calls';
import {
  acceptTerms,
  expect,
  fillCard,
  fillDetails,
  pay,
  reachSummary,
  startPurchase,
  test,
} from '../support/fixtures';

test.describe('hostile input', () => {
  const hostile = [
    ['markup that runs a script', '<img src=x onerror="window.__xss=1">'],
    ['a script tag', '<script>window.__xss=1</script>'],
  ] as const;

  for (const [label, payload] of hostile) {
    test(`${label} in the address is refused before anything is sent`, async ({
      page,
      backend,
    }) => {
      await startPurchase(page);
      await fillCard(page, CARDS.approved);
      await fillDetails(page, { address: payload });
      await acceptTerms(page);
      await page.getByRole('button', { name: 'Continuar al resumen' }).click();
      await expect(page.getByLabel('Dirección')).toHaveAccessibleDescription(
        'Quita los caracteres especiales, como < o >.',
      );
      expect(
        await page.evaluate(() => (window as unknown as { __xss?: number }).__xss),
      ).toBeUndefined();
      expect(backend.providerCalls).toHaveLength(0);
      expect(checkouts(backend.calls)).toHaveLength(0);
    });
  }

  test('query and operator strings are plain text: shown as typed, never run', async ({
    page,
    backend,
  }) => {
    const text = `x'; DROP TABLE coffees; -- {"$ne":""}`;
    await reachSummary(page, CARDS.approved);
    await page.goBack();
    // Wait for the saved value to load, or it could overwrite what is typed next.
    await expect(page.getByLabel('Dirección')).toHaveValue(PERSON.address);
    await page.getByLabel('Dirección').fill(text);
    await page.getByRole('button', { name: 'Continuar al resumen' }).click();
    const summary = page.getByRole('dialog', { name: 'Resumen del pedido' });
    await expect(summary).toContainText(text);
    await pay(page);
    await expect(page.getByRole('heading', { name: 'Pago aprobado' })).toBeVisible();
    const sent = checkouts(backend.calls)[0] as unknown as {
      body: { delivery: { address: string } };
    };
    expect(sent.body.delivery.address).toBe(text);
  });

  test('the quantity can never go above what is in stock or the limit per order', async ({
    page,
    backend,
  }) => {
    void backend;
    await page.goto('/');
    const first = page.locator('article').first();
    const up = first.getByRole('button', { name: 'Aumentar cantidad' });
    for (let i = 0; i < 30 && (await up.isEnabled()); i++) await up.click();
    await expect(up).toBeDisabled();
    const shown = Number(
      await first
        .getByRole('group', { name: 'Cantidad' })
        .innerText()
        .then((t) => t.replace(/\D/g, '')),
    );
    expect(shown).toBeGreaterThan(1);
    expect(shown).toBeLessThanOrEqual(10);
  });
});
