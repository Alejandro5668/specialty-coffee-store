import { screen } from '@testing-library/react';
import { NOW } from '../../../test/state';
import {
  CVC,
  NUMBER,
  accept,
  fillCard,
  fillPerson,
  ready,
  setup,
  submit,
} from '../../../test/detailsHarness';

describe('DetailsContainer: continuing', () => {
  it('asks for every missing field in plain words, puts the focus on the first one and does not call the service', async () => {
    const { user, tokenize } = await setup();
    await ready();
    await submit(user);
    expect(screen.getByLabelText('Número de tarjeta')).toHaveAccessibleDescription(
      'Ingresa el número de tarjeta.',
    );
    expect(screen.getByLabelText('Fecha de vencimiento')).toHaveAccessibleDescription(
      'Ingresa la fecha de vencimiento como MM / AA.',
    );
    expect(screen.getByLabelText('Código de seguridad')).toHaveAccessibleDescription(
      'Ingresa los 3 dígitos del reverso de la tarjeta.',
    );
    expect(screen.getByLabelText('Nombre completo')).toHaveAccessibleDescription(
      'Ingresa tu nombre completo.',
    );
    expect(screen.getByLabelText('Correo electrónico')).toHaveAccessibleDescription(
      'Ingresa un correo válido, como ana@example.com.',
    );
    expect(screen.getByLabelText('Teléfono')).toHaveAccessibleDescription(
      'Ingresa un teléfono de 7 a 15 dígitos.',
    );
    expect(
      screen.getByRole('checkbox', { name: /términos y condiciones/i }),
    ).toHaveAccessibleDescription('Acepta los términos y condiciones para continuar.');
    expect(screen.getByRole('checkbox', { name: /datos personales/i })).toHaveAccessibleDescription(
      'Autoriza el uso de tus datos personales para continuar.',
    );
    expect(screen.getByLabelText('Número de tarjeta')).toHaveFocus();
    expect(tokenize).not.toHaveBeenCalled();
  });

  it.each([
    [
      'a card number that does not add up',
      'Número de tarjeta',
      '4242 4242 4242 4241',
      'Revisa el número de tarjeta: no parece válido.',
    ],
    [
      'a card we do not take',
      'Número de tarjeta',
      '3782 8224 6310 005',
      'Aceptamos Visa y Mastercard.',
    ],
    [
      'an expired card',
      'Fecha de vencimiento',
      '1020',
      'Esta tarjeta está vencida. Usa otra tarjeta.',
    ],
    [
      'a short name',
      'Nombre en la tarjeta',
      'Ana',
      'Ingresa el nombre como aparece en la tarjeta (mínimo 5 caracteres).',
    ],
  ])('refuses %s without calling the service', async (_label, field, value, message) => {
    const { user, tokenize } = await setup();
    await ready();
    await fillCard(user);
    await user.clear(screen.getByLabelText(field));
    await user.type(screen.getByLabelText(field), value);
    await fillPerson(user);
    await accept(user);
    await submit(user);
    expect(screen.getByLabelText(field)).toHaveAccessibleDescription(message);
    expect(tokenize).not.toHaveBeenCalled();
  });

  it('refuses markup in the delivery fields', async () => {
    const { user, tokenize } = await setup();
    await ready();
    await fillCard(user);
    await fillPerson(user);
    await user.clear(screen.getByLabelText('Dirección'));
    await user.type(screen.getByLabelText('Dirección'), '<script>alert(1)</script>');
    await accept(user);
    await submit(user);
    expect(screen.getByLabelText('Dirección')).toHaveAccessibleDescription(
      'Quita los caracteres especiales, como < o >.',
    );
    expect(tokenize).not.toHaveBeenCalled();
  });

  it('sends the card straight to the payment service, keeps only the token, and moves on', async () => {
    const { user, tokenize, store } = await setup();
    await ready();
    await fillCard(user);
    await fillPerson(user);
    await accept(user);
    await submit(user);

    expect(await screen.findByText('Summary step')).toBeInTheDocument();
    expect(tokenize).toHaveBeenCalledTimes(1);
    expect(tokenize).toHaveBeenCalledWith({
      number: '4242424242424242',
      cvc: CVC,
      expMonth: '12',
      expYear: '30',
      holder: 'Ana Pérez',
    });
    expect(store.getState().checkout.card).toEqual({
      token: 'tok_test_123456',
      brand: 'visa',
      last4: '4242',
      at: NOW,
    });
    expect(store.getState().checkout.accepted).toEqual({ terms: true, personalData: true });
  });

  it('never lets the card number or the security code reach Redux, an action or the saved draft', async () => {
    const { user, store, storage, dispatchSpy } = await setup();
    await ready();
    await fillCard(user);
    await fillPerson(user);
    await accept(user);
    await submit(user);
    await screen.findByText('Summary step');

    const seen = [
      JSON.stringify(dispatchSpy.mock.calls),
      JSON.stringify(store.getState()),
      [...storage.data.values()].join(''),
    ].join('\n');
    expect(seen).not.toContain('4242424242424242');
    expect(seen).not.toContain(NUMBER);
    expect(seen).not.toContain(CVC);
  });

  it('does not call the service twice when the button is pressed again while it works', async () => {
    let release: (c: { token: string; brand: 'visa'; last4: string }) => void = () => undefined;
    const { user, tokenize } = await setup({
      tokenizer: () => new Promise((resolve) => (release = resolve)),
    });
    await ready();
    await fillCard(user);
    await fillPerson(user);
    await accept(user);
    await submit(user);
    const button = screen.getByRole('button', { name: 'Verificando tu tarjeta…' });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(tokenize).toHaveBeenCalledTimes(1);
    release({ token: 'tok_test_123456', brand: 'visa', last4: '4242' });
    expect(await screen.findByText('Summary step')).toBeInTheDocument();
  });
});
