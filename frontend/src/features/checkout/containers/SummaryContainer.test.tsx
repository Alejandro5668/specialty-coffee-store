import { screen } from '@testing-library/react';
import { CARD_TTL_MS } from '../../../store/checkoutState';
import { coffee, options, setupSummary } from '../../../test/summaryHarness';
import { draft, NOW } from '../../../test/state';

const sheet = () => screen.findByRole('dialog', { name: 'Resumen del pedido' });

describe('SummaryContainer: who may see it', () => {
  it.each([
    ['nothing was chosen', draft({ variantId: null }), 'Catalog page'],
    ['an order was already placed', draft({ orderId: 'order-9' }), 'Order page'],
    ['the details are not complete', draft({ customer: { name: '', email: '' } }), 'Details step'],
    [
      'the terms were not accepted',
      draft({ accepted: { terms: false, personalData: true } }),
      'Details step',
    ],
    ['there is no card', draft({ card: null }), 'Details step'],
    [
      'the card went stale',
      draft({
        card: { token: 'tok_test_123456', brand: 'visa', last4: '4242', at: NOW - CARD_TTL_MS - 1 },
      }),
      'Details step',
    ],
  ])('sends the shopper on when %s', async (_label, state, page) => {
    await setupSummary({ state });
    expect(await screen.findByText(page)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('SummaryContainer: the amounts', () => {
  it('shows the coffee, the base fee, the delivery fee and the total', async () => {
    await setupSummary();
    const dialog = await sheet();
    expect(dialog).toHaveTextContent('Huila Lavado, 250 g × 2');
    expect(await screen.findByTestId('line-product')).toHaveTextContent('$64.000');
    expect(screen.getByTestId('line-base')).toHaveTextContent('$3.000');
    expect(screen.getByTestId('line-delivery')).toHaveTextContent('$8.000');
    expect(screen.getByTestId('line-total')).toHaveTextContent('$75.000');
    expect(screen.getByRole('button', { name: 'Pagar $75.000' })).toBeEnabled();
  });

  it('takes the price from the catalog now, never from anything saved', async () => {
    await setupSummary({
      catalog: [
        {
          ...coffee(),
          variants: [{ ...coffee().variants[0], priceInCents: 4_000_000 }, coffee().variants[1]],
        },
      ],
    });
    expect(await screen.findByTestId('line-product')).toHaveTextContent('$80.000');
    expect(screen.getByTestId('line-total')).toHaveTextContent('$91.000');
  });

  it('shows how the order will be paid and where it will go', async () => {
    await setupSummary();
    const dialog = await sheet();
    expect(dialog).toHaveTextContent('Visa terminada en 4242');
    expect(dialog).toHaveTextContent('Ana Pérez');
    expect(dialog).toHaveTextContent('Calle 10 # 5-20, Medellín');
  });

  it('waits for the coffees and the fees before it asks for money', async () => {
    await setupSummary({ catalog: 'pending' });
    expect(await screen.findByText('Cargando tu pedido…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Pagar/ })).not.toBeInTheDocument();
  });

  it('shows hostile saved text as plain text', async () => {
    await setupSummary({
      state: draft({
        delivery: {
          recipientName: '<img src=x onerror=alert(1)>',
          address: '<script>alert(1)</script>',
          city: 'Cali',
          phone: '3001234567',
        },
      }),
    });
    await screen.findByText('Cargando tu pedido…').catch(() => undefined);
    expect(document.querySelectorAll('script, img[onerror]')).toHaveLength(0);
  });
});

describe('SummaryContainer: when there is less stock than the quantity', () => {
  it('says "quedan" when more than one unit is left', async () => {
    await setupSummary({ state: draft({ quantity: 3 }), catalog: [coffee([2, 2])] });
    expect(
      await screen.findByText('Solo quedan 2. Vuelve y elige menos unidades.'),
    ).toBeInTheDocument();
  });
});

describe('SummaryContainer: when it cannot be paid', () => {
  it.each([
    [
      'the size is sold out',
      [0, 0] as [number, number],
      'Este tamaño está agotado. Vuelve y elige otro café.',
    ],
    [
      'there is less stock than the quantity',
      [1, 1] as [number, number],
      'Solo queda 1. Vuelve y elige menos unidades.',
    ],
  ])('explains it when %s', async (_label, stocks, message) => {
    await setupSummary({ catalog: [coffee(stocks)] });
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Pagar/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver a los cafés' })).toBeInTheDocument();
  });

  it('explains it when the coffee no longer exists', async () => {
    await setupSummary({ catalog: [] });
    expect(
      await screen.findByText('Ese café ya no está disponible. Vuelve y elige otro.'),
    ).toBeInTheDocument();
  });

  it('says what happened when the fees cannot be loaded, and can try again', async () => {
    let fail = true;
    const { user } = await setupSummary({
      api: {
        getCheckoutOptions: async () => {
          if (fail) throw new Error('boom');
          return options;
        },
      },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Algo salió mal. Inténtalo de nuevo en un minuto.',
    );
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Intentar de nuevo' }));
    expect(await screen.findByRole('button', { name: 'Pagar $75.000' })).toBeEnabled();
  });
});
