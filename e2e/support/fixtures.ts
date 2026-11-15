import { expect, test as base, type Page } from '@playwright/test';
import { PERSON } from './data';
import { FakeBackend } from './fake-backend';

type Fixtures = { backend: FakeBackend };

/** `backend` is a fresh simulated API and payment service, installed before the page loads. */
export const test = base.extend<Fixtures>({
  backend: async ({ page }, use) => {
    const backend = new FakeBackend();
    await backend.install(page);
    await use(backend);
  },
});
export { expect };

/** Opens the form for the first coffee. */
export const startPurchase = async (page: Page, quantityUps = 0): Promise<void> => {
  await page.goto('/');
  const first = page.locator('article').first();
  await first.getByRole('heading').waitFor();
  for (let i = 0; i < quantityUps; i++)
    await first.getByRole('button', { name: 'Aumentar cantidad' }).click();
  await first.getByRole('button', { name: 'Pagar con tarjeta de crédito' }).click();
  await expect(page.getByRole('dialog', { name: 'Tarjeta y entrega' })).toBeVisible();
};

export const fillCard = async (page: Page, number: string): Promise<void> => {
  await page.getByLabel('Número de tarjeta').fill(number);
  await page.getByLabel('Fecha de vencimiento').fill('1230');
  await page.getByLabel('Código de seguridad').fill('123');
  await page.getByLabel('Nombre en la tarjeta').fill(PERSON.cardHolder);
};

export const fillDetails = async (page: Page, over: Partial<typeof PERSON> = {}): Promise<void> => {
  const p = { ...PERSON, ...over };
  await page.getByLabel('Nombre completo').fill(p.name);
  await page.getByLabel('Correo electrónico').fill(p.email);
  await page.getByLabel('Dirección').fill(p.address);
  await page.getByLabel('Ciudad').fill(p.city);
  await page.getByLabel('Teléfono').fill(p.phone);
};

export const acceptTerms = async (page: Page): Promise<void> => {
  await page.getByRole('checkbox', { name: /términos y condiciones/ }).check();
  await page.getByRole('checkbox', { name: /datos personales/ }).check();
};

export const continueToSummary = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Continuar al resumen' }).click();
  await expect(page.getByRole('dialog', { name: 'Resumen del pedido' })).toBeVisible();
};

/** From the catalog to the summary with a valid form. */
export const reachSummary = async (page: Page, number: string, quantityUps = 0): Promise<void> => {
  await startPurchase(page, quantityUps);
  await fillCard(page, number);
  await fillDetails(page);
  await acceptTerms(page);
  await continueToSummary(page);
};

export const pay = (page: Page): Promise<void> =>
  page.getByRole('button', { name: /^Pagar \$/ }).click();
