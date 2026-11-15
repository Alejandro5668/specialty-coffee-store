import type { Page } from '@playwright/test';
import { CARDS } from '../support/data';
import { expect, pay, reachSummary, startPurchase, test } from '../support/fixtures';

/** English the interface must no longer show. Spanish words that look alike (Total) are not listed. */
const ENGLISH =
  /\b(Loading|Try again|Pay with|Sold out|Back to|Continue to|Close|Card number|Full name|Address|Payment approved|Check again|in stock|left)\b/;

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

const outsideViewport = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('body *')]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1);
      })
      .map((e) => `${e.tagName}:${(e.textContent ?? '').slice(0, 20)}`),
  );

/** A hidden radio is touched through its label, so that is what is measured. */
const smallTargets = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('button, input:not([type=checkbox]), [role=radio]')]
      .map((e) =>
        e instanceof HTMLInputElement && e.type === 'radio' ? (e.closest('label') ?? e) : e,
      )
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 44);
      })
      .map(
        (e) => `${e.tagName}:${e.getAttribute('aria-label') ?? (e.textContent ?? '').slice(0, 20)}`,
      ),
  );

/** Every screen of the purchase must fit, be touchable and be written in Spanish. */
const check = async (page: Page, screen: string): Promise<void> => {
  expect(await overflow(page), `${screen}: horizontal scroll`).toBeLessThanOrEqual(0);
  expect(await outsideViewport(page), `${screen}: elements outside the screen`).toEqual([]);
  expect(await smallTargets(page), `${screen}: touch targets under 44 px`).toEqual([]);
  expect(await page.locator('body').innerText(), `${screen}: English text`).not.toMatch(ENGLISH);
};

test.describe('layout, touch and language on every screen', () => {
  test('the page declares its language and title in Spanish', async ({ page, backend }) => {
    void backend;
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page).toHaveTitle('Cafés - Tienda de café de especialidad');
  });

  test('catalog', async ({ page, backend }) => {
    void backend;
    await page.goto('/');
    await expect(page.locator('article')).toHaveCount(2);
    await check(page, 'catalog');
  });

  test('form', async ({ page, backend }) => {
    void backend;
    await startPurchase(page);
    await check(page, 'form');
    await page.getByRole('button', { name: 'Continuar al resumen' }).click();
    await check(page, 'form with errors');
  });

  test('summary and result', async ({ page, backend }) => {
    void backend;
    await reachSummary(page, CARDS.approved, 1);
    await check(page, 'summary');
    await pay(page);
    await expect(page.getByRole('heading', { name: 'Pago aprobado' })).toBeVisible();
    await check(page, 'result');
  });

  test('page not found', async ({ page, backend }) => {
    void backend;
    await page.goto('/no-existe');
    await expect(page.getByRole('heading', { name: 'No encontramos esa página' })).toBeVisible();
    await check(page, 'not found');
  });

  test('the catalog failing shows a plain message and a way to retry', async ({
    page,
    backend,
  }) => {
    backend.failProducts = true;
    await page.goto('/');
    await expect(page.getByRole('alert')).toContainText('Algo salió mal de nuestro lado.');
    backend.failProducts = false;
    await page.getByRole('button', { name: 'Intentar de nuevo' }).click();
    await expect(page.locator('article')).toHaveCount(2);
  });

  test('a sold-out coffee says so and cannot be bought', async ({ page, backend }) => {
    void backend;
    await page.goto('/');
    const soldOut = page.locator('article', { hasText: 'Sierra Nevada' });
    await expect(soldOut.getByText('Agotado', { exact: true })).toBeVisible();
    await expect(
      soldOut.getByRole('button', { name: 'Pagar con tarjeta de crédito' }),
    ).toBeDisabled();
  });

  test('images are decorative, and the ones below the first row load lazily', async ({
    page,
    backend,
  }) => {
    const [first] = backend.products;
    for (let n = 3; n <= 5; n++) {
      backend.products.push({ ...first, id: `extra-${n}`, name: `Café ${n}` });
    }
    await page.goto('/');
    const images = page.locator('article img');
    await expect(images).toHaveCount(5);
    for (const image of await images.all()) await expect(image).toHaveAttribute('alt', '');
    await expect(images.first()).toHaveAttribute('loading', 'eager');
    await expect(images.last()).toHaveAttribute('loading', 'lazy');
  });
});
