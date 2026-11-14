import { screen } from '@testing-library/react';
import { CVC, NUMBER, accept, ready, setup, submit } from '../../../test/detailsHarness';

describe('DetailsContainer: required and optional fields', () => {
  it('says up front that every field is required unless it is marked optional', async () => {
    await setup();
    await ready();
    expect(screen.getByText('All fields are required unless marked optional.')).toBeInTheDocument();
    expect(screen.getByLabelText('Recipient name (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Recipient name (optional)')).toHaveAccessibleDescription(
      'Leave it empty and we use your name.',
    );
    expect(screen.getByLabelText('Address')).toBeInTheDocument();
  });

  it('goes on to the summary without a recipient name, and still asks for the rest', async () => {
    const { user, tokenize } = await setup();
    await ready();
    await user.type(screen.getByLabelText('Card number'), NUMBER);
    await user.type(screen.getByLabelText('Expiry date'), '1230');
    await user.type(screen.getByLabelText('Security code'), CVC);
    await user.type(screen.getByLabelText('Name on the card'), 'Ana Pérez');
    await user.type(screen.getByLabelText('Full name'), 'Ana Pérez');
    await user.type(screen.getByLabelText('Email'), 'ana@example.com');
    await user.type(screen.getByLabelText('Phone'), '300 123 4567');
    await accept(user);
    await submit(user);
    expect(screen.getByLabelText('Address')).toHaveAccessibleDescription(
      'Enter the delivery address.',
    );
    expect(screen.getByLabelText('Recipient name (optional)')).not.toHaveAttribute('aria-invalid');
    expect(tokenize).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Address'), 'Calle 10 # 5-20');
    await user.type(screen.getByLabelText('City'), 'Medellín');
    await submit(user);
    expect(await screen.findByText('Summary step')).toBeInTheDocument();
  });
});
