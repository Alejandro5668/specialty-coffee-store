import { act, screen } from '@testing-library/react';
import { orderView, setupOrder } from '../../../test/orderHarness';
import { draft } from '../../../test/state';
import { TransactionStatus } from '../../../api/types';

const stateWithOrder = () =>
  draft({ orderId: 'order-1', card: null, idempotencyKey: 'key-0001-aaaa' });
const open = (status: TransactionStatus, autoReturnMs = 3000) =>
  setupOrder({
    state: stateWithOrder(),
    autoReturnMs,
    fakeTimers: true,
    api: { getTransaction: async () => orderView(status) },
  });
const final = (title: string) => screen.findByRole('heading', { name: title });

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('OrderContainer: going back to the coffees by itself', () => {
  it('counts down after an approved payment and returns to the coffees with everything forgotten', async () => {
    const { store, tick } = open('APPROVED');
    await final('Payment approved');
    expect(screen.getByRole('timer')).toHaveTextContent('Returning to the coffees in 3 seconds.');
    tick(1000);
    expect(screen.getByRole('timer')).toHaveTextContent('Returning to the coffees in 2 seconds.');
    tick(2000);
    expect(await screen.findByText('Catalog page')).toBeInTheDocument();
    expect(store.getState().checkout).toMatchObject({
      variantId: null,
      orderId: null,
      customer: { name: '' },
    });
  });

  it('says "1 second" in the singular', async () => {
    const { tick } = open('APPROVED');
    await final('Payment approved');
    tick(2000);
    expect(screen.getByRole('timer')).toHaveTextContent('Returning to the coffees in 1 second.');
  });

  it('lets the shopper stay on the page, and then never leaves by itself', async () => {
    const { user, tick } = open('APPROVED');
    await final('Payment approved');
    await user.click(screen.getByRole('button', { name: 'Stay on this page' }));
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    tick(10_000);
    expect(screen.queryByText('Catalog page')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Payment approved' })).toBeInTheDocument();
  });

  it('keeps the details after a declined payment, so the shopper does not have to type them again', async () => {
    const { store, tick } = open('DECLINED');
    await final('Your card was declined');
    expect(screen.getByRole('timer')).toBeInTheDocument();
    tick(3000);
    expect(await screen.findByText('Catalog page')).toBeInTheDocument();
    expect(store.getState().checkout).toMatchObject({
      orderId: null,
      card: null,
      idempotencyKey: null,
      variantId: 'huila-washed-250',
      customer: { name: 'Ana Pérez', email: 'ana@example.com' },
    });
  });

  it('does the same after a payment that failed', async () => {
    const { store, tick } = open('ERROR');
    await final('We could not complete the payment');
    tick(3000);
    expect(await screen.findByText('Catalog page')).toBeInTheDocument();
    expect(store.getState().checkout.customer.name).toBe('Ana Pérez');
  });

  it('does not count down while the payment is still being confirmed', async () => {
    const { tick } = setupOrder({
      state: stateWithOrder(),
      autoReturnMs: 3000,
      fakeTimers: true,
      poll: { intervalMs: 1000, maxChecks: 3 },
      api: { getTransaction: async () => orderView('PENDING') },
    });
    await final('We are confirming your payment');
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    await act(async () => void jest.advanceTimersByTime(10_000));
    expect(screen.queryByText('Catalog page')).not.toBeInTheDocument();
    tick(0);
  });

  it('can be turned off', async () => {
    const { tick } = open('APPROVED', 0);
    await final('Payment approved');
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
    tick(60_000);
    expect(screen.queryByText('Catalog page')).not.toBeInTheDocument();
  });

  it('does not race the shopper who goes back by hand', async () => {
    const { user, tick } = open('APPROVED');
    await user.click(await screen.findByRole('button', { name: 'Back to the coffees' }));
    expect(await screen.findByText('Catalog page')).toBeInTheDocument();
    tick(10_000);
    expect(screen.getAllByText('Catalog page')).toHaveLength(1);
  });
});
