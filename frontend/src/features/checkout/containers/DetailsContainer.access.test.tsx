import { screen } from '@testing-library/react';
import { ApiError } from '../../../api/client';
import { CheckoutOptions } from '../../../api/types';
import { NUMBER, options, ready, setup } from '../../../test/detailsHarness';

describe('DetailsContainer: getting here', () => {
  it('sends the shopper back to the coffees when nothing was chosen', async () => {
    await setup({ selected: false });
    expect(await screen.findByText('Catalog page')).toBeInTheDocument();
  });

  it('goes to the order when one was already placed, so a payment is never repeated', async () => {
    await setup({
      prepare: (s) =>
        s.dispatch({ type: 'checkout/placeOrder/fulfilled', payload: { id: 'order-9' } }),
    });
    expect(await screen.findByText('Order page')).toBeInTheDocument();
  });

  it('opens as a dialog with the three parts of the form', async () => {
    await setup();
    expect(screen.getByRole('dialog', { name: 'Card and delivery' })).toBeInTheDocument();
    for (const name of ['Card', 'Your details', 'Delivery']) {
      expect(screen.getByRole('group', { name })).toBeInTheDocument();
    }
  });

  it('shows where to read the terms once they are loaded, with links that open safely', async () => {
    await setup();
    const terms = await ready();
    expect(terms).toHaveAttribute('href', 'https://example.test/terms.pdf');
    expect(terms).toHaveAttribute('target', '_blank');
    expect(terms).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: 'personal data' })).toHaveAttribute(
      'href',
      'https://example.test/data.pdf',
    );
  });

  it('waits for the terms before letting the shopper continue', async () => {
    let release: (o: CheckoutOptions) => void = () => undefined;
    await setup({ getCheckoutOptions: () => new Promise((resolve) => (release = resolve)) });
    expect(screen.getByRole('button', { name: 'Continue to summary' })).toBeDisabled();
    expect(screen.getByText('Loading the terms…')).toBeInTheDocument();
    release(options);
    expect(await ready()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue to summary' })).toBeEnabled();
  });

  it('says what happened when the terms cannot be loaded, and offers to try again', async () => {
    let fail = true;
    const { user } = await setup({
      getCheckoutOptions: async () => {
        if (fail)
          throw new ApiError(
            503,
            'GATEWAY_UNAVAILABLE',
            'We cannot reach the payment service right now. Try again in a minute.',
          );
        return options;
      },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We cannot reach the payment service right now.',
    );
    expect(screen.getByRole('button', { name: 'Continue to summary' })).toBeDisabled();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await ready()).toBeInTheDocument();
  });
});

describe('DetailsContainer: typing', () => {
  it('groups the card number, shows the brand and keeps only digits', async () => {
    const { user } = await setup();
    const number = screen.getByLabelText('Card number');
    await user.type(number, '4242a42424');
    expect(number).toHaveValue('4242 4242 4');
    expect(screen.getByRole('img', { name: 'Visa' })).toBeInTheDocument();
    await user.clear(number);
    await user.type(number, '5555');
    expect(screen.getByRole('img', { name: 'Mastercard' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Visa' })).not.toBeInTheDocument();
  });

  it('writes the expiry as MM / YY and limits the security code to three digits', async () => {
    const { user } = await setup();
    await user.type(screen.getByLabelText('Expiry date'), '1230');
    await user.type(screen.getByLabelText('Security code'), '12a3456');
    expect(screen.getByLabelText('Expiry date')).toHaveValue('12 / 30');
    expect(screen.getByLabelText('Security code')).toHaveValue('123');
  });

  it('asks the phone keypad for digits and the right autofill for each field', async () => {
    await setup();
    expect(screen.getByLabelText('Card number')).toHaveAttribute('autocomplete', 'cc-number');
    expect(screen.getByLabelText('Card number')).toHaveAttribute('inputmode', 'numeric');
    expect(screen.getByLabelText('Expiry date')).toHaveAttribute('autocomplete', 'cc-exp');
    expect(screen.getByLabelText('Security code')).toHaveAttribute('autocomplete', 'cc-csc');
    expect(screen.getByLabelText('Name on the card')).toHaveAttribute('autocomplete', 'cc-name');
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Phone')).toHaveAttribute('type', 'tel');
  });

  it('keeps what the shopper types about themselves in the saved draft, but never the card', async () => {
    const { user, store } = await setup();
    await user.type(screen.getByLabelText('Full name'), 'Ana');
    await user.type(screen.getByLabelText('City'), 'Cali');
    await user.type(screen.getByLabelText('Card number'), NUMBER);
    expect(store.getState().checkout.customer.name).toBe('Ana');
    expect(store.getState().checkout.delivery.city).toBe('Cali');
    expect(JSON.stringify(store.getState())).not.toContain('4242424242424242');
    expect(JSON.stringify(store.getState())).not.toContain(NUMBER);
  });
});
