import { screen } from '@testing-library/react';
import { TokenizeError } from '../../../api/tokenizer';
import {
  NUMBER,
  accept,
  fillCard,
  fillPerson,
  ready,
  setup,
  submit,
} from '../../../test/detailsHarness';

describe('DetailsContainer: when the payment service says no', () => {
  it('points at the field the payment service refused and keeps what was typed', async () => {
    const { user } = await setup({
      tokenizer: async () => {
        throw new TokenizeError(
          'Este número de tarjeta no es aceptado. Revísalo o usa otra tarjeta.',
          'number',
        );
      },
    });
    await ready();
    await fillCard(user);
    await fillPerson(user);
    await accept(user);
    await submit(user);
    expect(await screen.findByLabelText('Número de tarjeta')).toHaveAccessibleDescription(
      'Este número de tarjeta no es aceptado. Revísalo o usa otra tarjeta.',
    );
    expect(screen.getByLabelText('Número de tarjeta')).toHaveValue(NUMBER);
    expect(screen.getByLabelText('Número de tarjeta')).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Continuar al resumen' })).toBeEnabled();
  });

  it('says what happened when the payment service cannot be reached, and lets the shopper retry', async () => {
    let fail = true;
    const { user, tokenize } = await setup({
      tokenizer: async () => {
        if (fail)
          throw new TokenizeError(
            'No pudimos conectar con el servicio de pagos. Revisa tu conexión e inténtalo de nuevo.',
            null,
          );
        return { token: 'tok_test_123456', brand: 'visa' as const, last4: '4242' };
      },
    });
    await ready();
    await fillCard(user);
    await fillPerson(user);
    await accept(user);
    await submit(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos conectar con el servicio de pagos.',
    );
    fail = false;
    await submit(user);
    expect(await screen.findByText('Summary step')).toBeInTheDocument();
    expect(tokenize).toHaveBeenCalledTimes(2);
  });

  it('never shows a raw error from the code', async () => {
    const { user } = await setup({
      tokenizer: async () => {
        throw new TypeError("Cannot read properties of undefined (reading 'x')");
      },
    });
    await ready();
    await fillCard(user);
    await fillPerson(user);
    await accept(user);
    await submit(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Algo salió mal. Inténtalo de nuevo en un minuto.',
    );
  });
});
