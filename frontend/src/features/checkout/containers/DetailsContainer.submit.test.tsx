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
    expect(screen.getByLabelText('Card number')).toHaveAccessibleDescription(
      'Enter the card number.',
    );
    expect(screen.getByLabelText('Expiry date')).toHaveAccessibleDescription(
      'Enter the expiry date as MM / YY.',
    );
    expect(screen.getByLabelText('Security code')).toHaveAccessibleDescription(
      'Enter the 3 digits on the back of the card.',
    );
    expect(screen.getByLabelText('Full name')).toHaveAccessibleDescription('Enter your full name.');
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
      'Enter a valid email, like ana@example.com.',
    );
    expect(screen.getByLabelText('Phone')).toHaveAccessibleDescription(
      'Enter a phone number with 7 to 15 digits.',
    );
    expect(
      screen.getByRole('checkbox', { name: /terms and conditions/i }),
    ).toHaveAccessibleDescription('Accept the terms and conditions to continue.');
    expect(screen.getByRole('checkbox', { name: /personal data/i })).toHaveAccessibleDescription(
      'Authorize the use of your personal data to continue.',
    );
    expect(screen.getByLabelText('Card number')).toHaveFocus();
    expect(tokenize).not.toHaveBeenCalled();
  });

  it.each([
    [
      'a card number that does not add up',
      'Card number',
      '4242 4242 4242 4241',
      'Check the card number: it does not look valid.',
    ],
    [
      'a card we do not take',
      'Card number',
      '3782 8224 6310 005',
      'We accept Visa and Mastercard.',
    ],
    ['an expired card', 'Expiry date', '1020', 'This card has expired. Use another card.'],
    [
      'a short name',
      'Name on the card',
      'Ana',
      'Enter the name as it appears on the card (at least 5 characters).',
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
    await user.clear(screen.getByLabelText('Address'));
    await user.type(screen.getByLabelText('Address'), '<script>alert(1)</script>');
    await accept(user);
    await submit(user);
    expect(screen.getByLabelText('Address')).toHaveAccessibleDescription(
      'Remove special characters such as < or >.',
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
    const button = screen.getByRole('button', { name: 'Checking your card…' });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(tokenize).toHaveBeenCalledTimes(1);
    release({ token: 'tok_test_123456', brand: 'visa', last4: '4242' });
    expect(await screen.findByText('Summary step')).toBeInTheDocument();
  });
});
