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
          'This card number is not accepted. Check it or use another card.',
          'number',
        );
      },
    });
    await ready();
    await fillCard(user);
    await fillPerson(user);
    await accept(user);
    await submit(user);
    expect(await screen.findByLabelText('Card number')).toHaveAccessibleDescription(
      'This card number is not accepted. Check it or use another card.',
    );
    expect(screen.getByLabelText('Card number')).toHaveValue(NUMBER);
    expect(screen.getByLabelText('Card number')).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Continue to summary' })).toBeEnabled();
  });

  it('says what happened when the payment service cannot be reached, and lets the shopper retry', async () => {
    let fail = true;
    const { user, tokenize } = await setup({
      tokenizer: async () => {
        if (fail)
          throw new TokenizeError(
            'We could not reach the payment service. Check your connection and try again.',
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
      'We could not reach the payment service.',
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
      'Something went wrong. Try again in a minute.',
    );
  });
});
