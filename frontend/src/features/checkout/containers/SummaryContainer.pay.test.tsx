import { screen } from '@testing-library/react';
import { ApiError } from '../../../api/client';
import { OrderRequest, TransactionView } from '../../../api/types';
import { placed, setupSummary } from '../../../test/summaryHarness';

const pay = () => screen.findByRole('button', { name: 'Pay $75.000' });

describe('SummaryContainer: paying', () => {
  it('places the order with fresh terms and goes to the order page', async () => {
    const sent: OrderRequest[] = [];
    const { user, store } = await setupSummary({
      api: {
        createOrder: async (request) => {
          sent.push(request);
          return placed('order-7');
        },
      },
    });
    await user.click(await pay());
    expect(await screen.findByText('Order page')).toBeInTheDocument();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      acceptanceToken: 'acc_fresh',
      personalAuthToken: 'per_fresh',
      cardToken: 'tok_test_123456',
      quantity: 2,
    });
    expect(store.getState().checkout.orderId).toBe('order-7');
  });

  it('shows that it is working and cannot be pressed twice', async () => {
    let release: (v: TransactionView) => void = () => undefined;
    let calls = 0;
    const { user } = await setupSummary({
      api: {
        createOrder: () => {
          calls++;
          return new Promise((resolve) => (release = resolve));
        },
      },
    });
    await user.click(await pay());
    const working = await screen.findByRole('button', { name: 'Paying…' });
    expect(working).toBeDisabled();
    await user.click(working);
    expect(calls).toBe(1);
    release(placed());
    expect(await screen.findByText('Order page')).toBeInTheDocument();
    expect(calls).toBe(1);
  });

  it('keeps the shopper here with the plain message when the server says no', async () => {
    const { user } = await setupSummary({
      api: {
        createOrder: async () => {
          throw new ApiError(
            409,
            'OUT_OF_STOCK',
            'There is not enough stock for that quantity. Choose fewer units.',
          );
        },
      },
    });
    await user.click(await pay());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'There is not enough stock for that quantity. Choose fewer units.',
    );
    expect(screen.getByRole('button', { name: 'Pay $75.000' })).toBeEnabled();
    expect(screen.queryByText('Order page')).not.toBeInTheDocument();
  });

  it('retries with the same key, so an answer that was lost can never charge twice', async () => {
    const keys: string[] = [];
    let fail = true;
    const { user } = await setupSummary({
      api: {
        createOrder: async (request) => {
          keys.push(request.idempotencyKey);
          if (fail)
            throw new ApiError(
              0,
              'NETWORK',
              'We could not confirm your order. Press Pay again: you will not be charged twice.',
            );
          return placed();
        },
      },
    });
    await user.click(await pay());
    expect(await screen.findByRole('alert')).toHaveTextContent('you will not be charged twice');
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Pay $75.000' }));
    expect(await screen.findByText('Order page')).toBeInTheDocument();
    expect(keys).toEqual(['key-new-0001', 'key-new-0001']);
  });
});

describe('SummaryContainer: leaving', () => {
  it('goes back to edit the details without losing them', async () => {
    const { user, store } = await setupSummary();
    await user.click(await screen.findByRole('button', { name: 'Edit details' }));
    expect(await screen.findByText('Details step')).toBeInTheDocument();
    expect(store.getState().checkout.customer.name).toBe('Ana Pérez');
  });

  it('closes to the coffees and keeps the draft', async () => {
    const { user, store } = await setupSummary();
    await user.click(await screen.findByRole('button', { name: 'Close' }));
    expect(await screen.findByText('Catalog page')).toBeInTheDocument();
    expect(store.getState().checkout.card).not.toBeNull();
  });
});
