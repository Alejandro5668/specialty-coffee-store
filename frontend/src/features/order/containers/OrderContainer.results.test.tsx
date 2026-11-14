import { screen } from '@testing-library/react';
import { orderView, setupOrder } from '../../../test/orderHarness';
import { draft } from '../../../test/state';

const stateWithOrder = () =>
  draft({ orderId: 'order-1', card: null, idempotencyKey: 'key-0001-aaaa' });

describe('OrderContainer: the result', () => {
  it('shows an approved payment with the amounts the server charged', async () => {
    setupOrder({
      state: stateWithOrder(),
      api: { getTransaction: async () => orderView('APPROVED') },
    });
    expect(await screen.findByRole('heading', { name: 'Payment approved' })).toBeInTheDocument();
    expect(screen.getByText('Huila Washed, 250 g × 2')).toBeInTheDocument();
    expect(await screen.findByTestId('line-product')).toHaveTextContent('$64.000');
    expect(screen.getByTestId('line-base')).toHaveTextContent('$3.000');
    expect(screen.getByTestId('line-delivery')).toHaveTextContent('$8.000');
    expect(screen.getByTestId('line-total')).toHaveTextContent('$75.000');
    expect(screen.getByText('Order reference: order-1')).toBeInTheDocument();
  });

  it('shows the server amounts even if the catalog price has changed since', async () => {
    setupOrder({
      state: stateWithOrder(),
      api: {
        getTransaction: async () => orderView('APPROVED'),
        listProducts: async () => [
          {
            id: 'huila-washed',
            name: 'Huila Washed',
            description: '',
            imageUrl: '/i.webp',
            variants: [
              {
                id: 'huila-washed-250',
                sizeGrams: 250,
                priceInCents: 9_900_000,
                currency: 'COP',
                stock: 5,
              },
            ],
          },
        ],
      },
    });
    expect(await screen.findByTestId('line-total')).toHaveTextContent('$75.000');
  });

  it('explains a declined card, says nothing was charged and offers another card', async () => {
    const { user, store } = setupOrder({
      state: stateWithOrder(),
      api: { getTransaction: async () => orderView('DECLINED') },
    });
    expect(
      await screen.findByRole('heading', { name: 'Your card was declined' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Nothing was charged/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try another card' }));
    expect(await screen.findByText('Details step')).toBeInTheDocument();
    expect(store.getState().checkout).toMatchObject({
      orderId: null,
      idempotencyKey: null,
      card: null,
      customer: { name: 'Ana Pérez' },
      variantId: 'huila-washed-250',
    });
    expect(store.getState().order.view).toBeNull();
  });

  it('explains a payment that failed, says nothing was charged and offers to try again', async () => {
    setupOrder({
      state: stateWithOrder(),
      api: { getTransaction: async () => orderView('ERROR') },
    });
    expect(
      await screen.findByRole('heading', { name: 'We could not complete the payment' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Nothing was charged/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try another card' })).toBeInTheDocument();
  });

  it('forgets the purchase and shows the coffees again when the shopper goes back', async () => {
    const { user, store, storage } = setupOrder({
      state: stateWithOrder(),
      api: { getTransaction: async () => orderView('APPROVED') },
    });
    await user.click(await screen.findByRole('button', { name: 'Back to the coffees' }));
    expect(await screen.findByText('Catalog page')).toBeInTheDocument();
    expect(store.getState().checkout).toMatchObject({
      variantId: null,
      orderId: null,
      card: null,
      idempotencyKey: null,
      customer: { name: '', email: '' },
    });
    expect(store.getState().order.view).toBeNull();
    expect(storage.data.get('coffee-store:v2')).not.toContain('Ana');
  });

  it('keeps announcing the result to a screen reader', async () => {
    setupOrder({
      state: stateWithOrder(),
      api: { getTransaction: async () => orderView('APPROVED') },
    });
    const heading = await screen.findByRole('heading', { name: 'Payment approved' });
    expect(heading.closest('[role="status"]')).not.toBeNull();
  });
});
