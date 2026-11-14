import { screen } from '@testing-library/react';
import { createStore } from '../../../app/store';
import {
  cardTokenized,
  setAccepted,
  updateCustomer,
  updateDelivery,
} from '../../../store/checkoutSlice';
import { CARD_TTL_MS } from '../../../store/checkoutState';
import { NOW } from '../../../test/state';
import { ready, setup, submit } from '../../../test/detailsHarness';

describe('DetailsContainer: coming back', () => {
  const withSavedCard = (s: ReturnType<typeof createStore>) => {
    s.dispatch(updateCustomer({ name: 'Ana Pérez', email: 'ana@example.com' }));
    s.dispatch(
      updateDelivery({
        recipientName: 'Ana Pérez',
        address: 'Calle 10 # 5-20',
        city: 'Medellín',
        phone: '300 123 4567',
      }),
    );
    s.dispatch(setAccepted({ terms: true, personalData: true }));
    s.dispatch(cardTokenized({ token: 'tok_test_123456', brand: 'visa', last4: '4242', at: NOW }));
  };

  it('shows the saved card instead of asking for it again, and goes on without calling the service', async () => {
    const { user, tokenize } = await setup({ prepare: withSavedCard });
    await ready();
    expect(screen.getByText('Visa terminada en 4242')).toBeInTheDocument();
    expect(screen.queryByLabelText('Número de tarjeta')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Nombre completo')).toHaveValue('Ana Pérez');
    await submit(user);
    expect(await screen.findByText('Summary step')).toBeInTheDocument();
    expect(tokenize).not.toHaveBeenCalled();
  });

  it('asks for the card again, in plain words, when the saved one went stale while the form was open', async () => {
    let clock = NOW;
    const { user, store } = await setup({ prepare: withSavedCard, now: () => clock });
    await ready();
    clock = NOW + CARD_TTL_MS + 1;
    await submit(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Tu tarjeta guardada ya no es válida. Ingrésala de nuevo.',
    );
    expect(screen.getByLabelText('Número de tarjeta')).toBeInTheDocument();
    expect(store.getState().checkout.card).toBeNull();
  });

  it('lets the shopper use another card, and forgets the saved one', async () => {
    const { user, store } = await setup({ prepare: withSavedCard });
    await ready();
    await user.click(screen.getByRole('button', { name: 'Usar otra tarjeta' }));
    expect(screen.getByLabelText('Número de tarjeta')).toBeInTheDocument();
    expect(screen.queryByText('Visa terminada en 4242')).not.toBeInTheDocument();
    expect(store.getState().checkout.card).toBeNull();
  });

  it('closes without losing what was typed', async () => {
    const { user, store } = await setup();
    await ready();
    await user.type(screen.getByLabelText('Nombre completo'), 'Ana');
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(await screen.findByText('Catalog page')).toBeInTheDocument();
    expect(store.getState().checkout.customer.name).toBe('Ana');
  });
});
