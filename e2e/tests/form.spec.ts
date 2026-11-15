import { CARDS, PERSON } from '../support/data';
import {
  acceptTerms,
  continueToSummary,
  expect,
  fillCard,
  fillDetails,
  startPurchase,
  test,
} from '../support/fixtures';

const submit = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Continuar al resumen' }).click();

test.describe('the card and delivery form', () => {
  test.beforeEach(async ({ page, backend }) => {
    void backend;
    await startPurchase(page);
  });

  test('says up front which fields are optional', async ({ page }) => {
    await expect(
      page.getByText('Todos los campos son obligatorios, salvo los marcados como opcionales.'),
    ).toBeVisible();
    await expect(page.getByLabel('Nombre del destinatario (opcional)')).toBeVisible();
  });

  test('asks for every missing field in plain words and puts the focus on the first one', async ({
    page,
  }) => {
    await submit(page);
    const messages: Array<[string, string]> = [
      ['Número de tarjeta', 'Ingresa el número de tarjeta.'],
      ['Fecha de vencimiento', 'Ingresa la fecha de vencimiento como MM / AA.'],
      ['Código de seguridad', 'Ingresa los 3 dígitos del reverso de la tarjeta.'],
      [
        'Nombre en la tarjeta',
        'Ingresa el nombre como aparece en la tarjeta (mínimo 5 caracteres).',
      ],
      ['Nombre completo', 'Ingresa tu nombre completo.'],
      ['Correo electrónico', 'Ingresa un correo válido, como ana@example.com.'],
      ['Dirección', 'Ingresa la dirección de entrega.'],
      ['Ciudad', 'Ingresa la ciudad.'],
      ['Teléfono', 'Ingresa un teléfono de 7 a 15 dígitos.'],
    ];
    for (const [label, message] of messages) {
      await expect(page.getByLabel(label)).toHaveAccessibleDescription(message);
    }
    await expect(page.getByLabel('Número de tarjeta')).toBeFocused();
    await expect(page.getByText('Acepta los términos y condiciones para continuar.')).toBeVisible();
    await expect(
      page.getByText('Autoriza el uso de tus datos personales para continuar.'),
    ).toBeVisible();
  });

  test('shows the card brand while the number is typed', async ({ page }) => {
    const number = page.getByLabel('Número de tarjeta');
    await number.fill('4242');
    await expect(page.getByRole('img', { name: 'Visa' })).toBeVisible();
    await number.fill('5555');
    await expect(page.getByRole('img', { name: 'Mastercard' })).toBeVisible();
    await number.fill('9999');
    await expect(page.getByRole('img', { name: /Visa|Mastercard/ })).toHaveCount(0);
  });

  test('refuses a number that does not add up, and an expired card', async ({ page }) => {
    await fillCard(page, CARDS.luhnFails);
    await submit(page);
    await expect(page.getByLabel('Número de tarjeta')).toHaveAccessibleDescription(
      'Revisa el número de tarjeta: no parece válido.',
    );
    await page.getByLabel('Número de tarjeta').fill(CARDS.approved);
    await page.getByLabel('Fecha de vencimiento').fill('0120');
    await submit(page);
    await expect(page.getByLabel('Fecha de vencimiento')).toHaveAccessibleDescription(
      'Esta tarjeta está vencida. Usa otra tarjeta.',
    );
  });

  test('a card the payment service refuses points at the number, and keeps what was typed', async ({
    page,
  }) => {
    await fillCard(page, '4000000000000002');
    await fillDetails(page);
    await acceptTerms(page);
    await submit(page);
    await expect(page.getByLabel('Número de tarjeta')).toHaveAccessibleDescription(
      'Este número de tarjeta no es aceptado. Revísalo o usa otra tarjeta.',
    );
    await expect(page.getByLabel('Nombre completo')).toHaveValue(PERSON.name);
  });

  test('a payment service that cannot be reached says so and lets the shopper retry', async ({
    page,
  }) => {
    await page.route('https://payments.test/**', (route) => route.abort());
    await fillCard(page, CARDS.approved);
    await fillDetails(page);
    await acceptTerms(page);
    await submit(page);
    await expect(page.getByRole('alert')).toContainText(
      'No pudimos conectar con el servicio de pagos. Revisa tu conexión e inténtalo de nuevo.',
    );
    await expect(page.getByRole('button', { name: 'Continuar al resumen' })).toBeEnabled();
  });

  test('the recipient is optional: without one the order goes to the buyer', async ({ page }) => {
    await fillCard(page, CARDS.approved);
    await fillDetails(page);
    await acceptTerms(page);
    await continueToSummary(page);
    await expect(page.getByRole('dialog', { name: 'Resumen del pedido' })).toContainText(
      PERSON.name,
    );
  });

  test('Close and Escape leave the form and return to the coffees', async ({ page }) => {
    await page.getByRole('button', { name: 'Cerrar' }).click();
    await expect(page.getByRole('heading', { name: 'Cafés' })).toBeVisible();
    await startPurchase(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
