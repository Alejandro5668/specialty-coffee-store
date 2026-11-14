import { screen, waitFor } from '@testing-library/react';
import { ApiError } from '../../../api/client';
import { TransactionView } from '../../../api/types';
import { orderView, setupOrder } from '../../../test/orderHarness';

const heading = (name: string) => screen.findByRole('heading', { name });

describe('OrderContainer: while the payment is confirmed', () => {
  it('says it is checking, then that it is confirming, and keeps asking until the result is final', async () => {
    const answers: TransactionView[] = [
      orderView('PENDING'),
      orderView('PENDING'),
      orderView('APPROVED'),
    ];
    const calls: string[] = [];
    setupOrder({
      api: {
        getTransaction: async (id) => {
          calls.push(id);
          return answers.shift() ?? orderView('APPROVED');
        },
      },
    });
    expect(screen.getByText('Consultando tu pedido…')).toBeInTheDocument();
    expect(await heading('Estamos confirmando tu pago')).toBeInTheDocument();
    expect(await heading('Pago aprobado')).toBeInTheDocument();
    expect(calls.length).toBeGreaterThanOrEqual(3);
    expect(new Set(calls)).toEqual(new Set(['order-1']));
  });

  it('titles the tab "Tu pedido"', async () => {
    setupOrder({ api: { getTransaction: async () => orderView('APPROVED') } });
    await heading('Pago aprobado');
    expect(document.title).toBe('Tu pedido - Tienda de café de especialidad');
  });

  it('stops asking once the result is final', async () => {
    const getTransaction = jest.fn(async () => orderView('APPROVED'));
    setupOrder({ api: { getTransaction } });
    await heading('Pago aprobado');
    await new Promise((r) => setTimeout(r, 40));
    expect(getTransaction).toHaveBeenCalledTimes(1);
  });

  it('stops asking when the shopper leaves the page', async () => {
    const getTransaction = jest.fn(async () => orderView('PENDING'));
    const { unmount } = setupOrder({
      api: { getTransaction },
      poll: { intervalMs: 10, maxChecks: 100 },
    });
    await heading('Estamos confirmando tu pago');
    unmount();
    const seen = getTransaction.mock.calls.length;
    await new Promise((r) => setTimeout(r, 60));
    expect(getTransaction.mock.calls.length).toBe(seen);
  });

  it('says it is taking longer after a while, and checks again when asked', async () => {
    let approve = false;
    const { user } = setupOrder({
      poll: { intervalMs: 5, maxChecks: 3 },
      api: { getTransaction: async () => orderView(approve ? 'APPROVED' : 'PENDING') },
    });
    expect(await heading('Tu pago aún se está confirmando')).toBeInTheDocument();
    expect(screen.getByText(/más de lo habitual/i)).toBeInTheDocument();
    approve = true;
    await user.click(screen.getByRole('button', { name: 'Consultar de nuevo' }));
    expect(await heading('Pago aprobado')).toBeInTheDocument();
  });

  it('never asks two things at once', async () => {
    let running = 0;
    let most = 0;
    setupOrder({
      poll: { intervalMs: 1, maxChecks: 6 },
      api: {
        getTransaction: async () => {
          running++;
          most = Math.max(most, running);
          await new Promise((r) => setTimeout(r, 8));
          running--;
          return orderView('PENDING');
        },
      },
    });
    await heading('Tu pago aún se está confirmando');
    expect(most).toBe(1);
  });
});

describe('OrderContainer: when it cannot be read', () => {
  it('says the order does not exist, and stops asking', async () => {
    const getTransaction = jest.fn(async () => {
      throw new ApiError(404, 'TRANSACTION_NOT_FOUND', 'We could not find that order.');
    });
    setupOrder({ path: '/order/nope', api: { getTransaction } });
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not find that order.');
    await new Promise((r) => setTimeout(r, 40));
    expect(getTransaction).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Volver a los cafés' })).toBeInTheDocument();
  });

  it('does not repeat a hostile address in the page', async () => {
    setupOrder({
      path: '/order/%3Cscript%3Ealert(1)%3C%2Fscript%3E',
      api: {
        getTransaction: async () => {
          throw new ApiError(404, 'X', 'We could not find that order.');
        },
      },
    });
    await screen.findByRole('alert');
    expect(document.body.innerHTML).not.toContain('<script>alert');
  });

  it('keeps trying through a short outage, then says what happened and offers to try again', async () => {
    let calls = 0;
    const { user } = setupOrder({
      poll: { intervalMs: 5, maxChecks: 3 },
      api: {
        getTransaction: async () => {
          calls++;
          if (calls <= 3)
            throw new ApiError(
              0,
              'NETWORK',
              'No pudimos conectar con la tienda. Revisa tu conexión e inténtalo de nuevo.',
            );
          return orderView('APPROVED');
        },
      },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos conectar con la tienda.',
    );
    expect(calls).toBe(3);
    await user.click(screen.getByRole('button', { name: 'Intentar de nuevo' }));
    expect(await heading('Pago aprobado')).toBeInTheDocument();
  });

  it('never shows a raw error from the code', async () => {
    setupOrder({
      poll: { intervalMs: 5, maxChecks: 1 },
      api: {
        getTransaction: async () => {
          throw new TypeError("Cannot read properties of undefined (reading 'x')");
        },
      },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Algo salió mal. Inténtalo de nuevo en un minuto.',
    );
    await waitFor(() => expect(document.body.textContent).not.toContain('Cannot read'));
  });
});
