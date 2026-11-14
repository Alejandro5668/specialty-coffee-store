import { screen, within } from '@testing-library/react';
import { PERSIST_KEY, toPersistable } from '../store/persistence';
import { draft } from '../test/state';
import {
  choose500gTwice,
  CVC,
  everythingEverStored,
  fillTheForm,
  makeApp,
  makeShop,
  PAN,
} from '../test/journeyHarness';

jest.setTimeout(30_000);

describe('the whole purchase', () => {
  it('works from the coffees to the result and back, surviving a refresh at every step', async () => {
    const { shop, api } = makeShop();
    const app = makeApp(api);
    const { user, storage } = app;

    // 1. choose a coffee and open the card dialog
    let ui = app.mount('/');
    await choose500gTwice(user);
    expect(await screen.findByRole('dialog', { name: 'Tarjeta y entrega' })).toBeInTheDocument();

    // 2. refresh in the middle of the form: the details stay, the card is asked for again
    await user.type(screen.getByLabelText('Nombre completo'), 'Ana Pérez');
    await user.type(screen.getByLabelText('Número de tarjeta'), PAN);
    ui.unmount();
    ui = app.mount('/checkout/details');
    expect(await screen.findByLabelText('Nombre completo')).toHaveValue('Ana Pérez');
    expect(screen.getByLabelText('Número de tarjeta')).toHaveValue('');

    // 3. finish the form and reach the summary
    await fillTheForm(user);
    const summary = await screen.findByRole('dialog', { name: 'Resumen del pedido' });
    expect(summary).toHaveTextContent('Huila Washed, 500 g × 2');
    expect(await screen.findByTestId('line-total')).toHaveTextContent('$127.000');

    // 4. refresh on the summary: the same summary comes back, with the saved card
    ui.unmount();
    ui = app.mount('/checkout/summary');
    const again = await screen.findByRole('dialog', { name: 'Resumen del pedido' });
    expect(within(again).getByText('Visa terminada en 4242')).toBeInTheDocument();
    await user.click(await within(again).findByRole('button', { name: 'Pagar $127.000' }));

    // 5. the payment is confirmed, and a refresh on that page still finds the result
    expect(await screen.findByRole('heading', { name: 'Pago aprobado' })).toBeInTheDocument();
    ui.unmount();
    ui = app.mount('/order/order-1');
    expect(await screen.findByRole('heading', { name: 'Pago aprobado' })).toBeInTheDocument();
    expect(screen.getByTestId('line-total')).toHaveTextContent('$127.000');

    // 6. back to the coffees: the stock shows what is left
    await user.click(screen.getByRole('button', { name: 'Volver a los cafés' }));
    const card = within(
      (await screen.findByRole('heading', { name: 'Huila Washed' })).closest('article')!,
    );
    await user.click(card.getByRole('radio', { name: /500 g/ }));
    expect(card.getByText('Queda 1')).toBeInTheDocument();
    ui.unmount();

    // exactly one order, one tokenization, and the card never touched the saved draft
    expect(shop.requests).toHaveLength(1);
    expect(shop.requests[0]).toMatchObject({
      idempotencyKey: 'key-journey-0001',
      variantId: 'huila-washed-500',
      quantity: 2,
      cardToken: 'tok_test_123456',
      acceptanceToken: 'acc_fresh',
      personalAuthToken: 'per_fresh',
      customer: { name: 'Ana Pérez', email: 'ana@example.com' },
    });
    expect(app.tokenizer.tokenize).toHaveBeenCalledTimes(1);
    const stored = everythingEverStored(storage);
    expect(stored).not.toContain(PAN);
    expect(stored).not.toContain(CVC);
    expect(JSON.parse(storage.data.get(PERSIST_KEY)!).checkout).toMatchObject({
      variantId: null,
      orderId: null,
      card: null,
      customer: { name: '', email: '' },
    });
  });
});

describe('paying', () => {
  const withReadyDraft = (app: ReturnType<typeof makeApp>) =>
    app.storage.data.set(
      PERSIST_KEY,
      JSON.stringify({
        v: 2,
        checkout: toPersistable(draft({ variantId: 'huila-washed-500', quantity: 2 })),
      }),
    );

  it('never charges twice when the page is refreshed while the payment is in flight', async () => {
    const { shop, api } = makeShop();
    shop.hold = true;
    const app = makeApp(api);
    withReadyDraft(app);

    let ui = app.mount('/checkout/summary');
    await app.user.click(await screen.findByRole('button', { name: 'Pagar $127.000' }));
    expect(await screen.findByRole('button', { name: 'Pagando…' })).toBeDisabled();
    expect(shop.requests.map((r) => r.idempotencyKey)).toEqual(['key-journey-0001']);

    // the answer never arrives and the shopper refreshes
    ui.unmount();
    shop.hold = false;
    ui = app.mount('/checkout/summary');
    await app.user.click(await screen.findByRole('button', { name: 'Pagar $127.000' }));
    expect(await screen.findByRole('heading', { name: 'Pago aprobado' })).toBeInTheDocument();

    expect(shop.requests.map((r) => r.idempotencyKey)).toEqual([
      'key-journey-0001',
      'key-journey-0001',
    ]);
    expect(shop.stock500).toBe(1);
    expect(shop.orders.size).toBe(1);
    ui.unmount();
  });

  it('shows the order, not an old summary, when the shopper goes back after paying', async () => {
    const { api } = makeShop();
    const app = makeApp(api);
    app.storage.data.set(
      PERSIST_KEY,
      JSON.stringify({
        v: 2,
        checkout: toPersistable(
          draft({ variantId: 'huila-washed-500', quantity: 2, orderId: 'order-1', card: null }),
        ),
      }),
    );

    app.mountWithHistory(['/', '/checkout/summary', '/order/order-1']);
    expect(await screen.findByRole('heading', { name: 'Pago aprobado' })).toBeInTheDocument();
    await app.user.click(screen.getByRole('button', { name: 'Browser back' }));
    expect(await screen.findByRole('heading', { name: 'Pago aprobado' })).toBeInTheDocument();
    expect(screen.getByTestId('path')).toHaveTextContent('/order/order-1');
    expect(screen.queryByRole('dialog', { name: 'Resumen del pedido' })).not.toBeInTheDocument();
  });

  it('sends a shopper whose card went stale back to enter it again, with the details kept', async () => {
    const { api } = makeShop();
    const app = makeApp(api);
    const stale = draft({
      variantId: 'huila-washed-500',
      quantity: 2,
      card: { token: 'tok_test_123456', brand: 'visa', last4: '4242', at: 1 },
    });
    app.storage.data.set(PERSIST_KEY, JSON.stringify({ v: 2, checkout: toPersistable(stale) }));

    app.mount('/checkout/summary');
    expect(await screen.findByRole('dialog', { name: 'Tarjeta y entrega' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Número de tarjeta')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre completo')).toHaveValue('Ana Pérez');
  });
});
