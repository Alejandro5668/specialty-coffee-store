import { screen } from '@testing-library/react';
import { CVC, NUMBER, accept, ready, setup, submit } from '../../../test/detailsHarness';

describe('DetailsContainer: required and optional fields', () => {
  it('says up front that every field is required unless it is marked optional', async () => {
    await setup();
    await ready();
    expect(
      screen.getByText('Todos los campos son obligatorios, salvo los marcados como opcionales.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre del destinatario (opcional)')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre del destinatario (opcional)')).toHaveAccessibleDescription(
      'Si lo dejas vacío, usamos tu nombre.',
    );
    expect(screen.getByLabelText('Dirección')).toBeInTheDocument();
  });

  it('goes on to the summary without a recipient name, and still asks for the rest', async () => {
    const { user, tokenize } = await setup();
    await ready();
    await user.type(screen.getByLabelText('Número de tarjeta'), NUMBER);
    await user.type(screen.getByLabelText('Fecha de vencimiento'), '1230');
    await user.type(screen.getByLabelText('Código de seguridad'), CVC);
    await user.type(screen.getByLabelText('Nombre en la tarjeta'), 'Ana Pérez');
    await user.type(screen.getByLabelText('Nombre completo'), 'Ana Pérez');
    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@example.com');
    await user.type(screen.getByLabelText('Teléfono'), '300 123 4567');
    await accept(user);
    await submit(user);
    expect(screen.getByLabelText('Dirección')).toHaveAccessibleDescription(
      'Ingresa la dirección de entrega.',
    );
    expect(screen.getByLabelText('Nombre del destinatario (opcional)')).not.toHaveAttribute(
      'aria-invalid',
    );
    expect(tokenize).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Dirección'), 'Calle 10 # 5-20');
    await user.type(screen.getByLabelText('Ciudad'), 'Medellín');
    await submit(user);
    expect(await screen.findByText('Summary step')).toBeInTheDocument();
  });
});
