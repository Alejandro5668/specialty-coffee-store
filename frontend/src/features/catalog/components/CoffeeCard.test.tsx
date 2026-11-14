import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductView } from '../../../api/types';
import { CoffeeCard } from './CoffeeCard';

export const product: ProductView = {
  id: 'huila-washed',
  name: 'Huila Lavado',
  description: 'Caramel, red apple and a clean, sweet finish.',
  imageUrl: '/images/coffees/huila-washed.webp',
  variants: [
    { id: 'huila-washed-250', sizeGrams: 250, priceInCents: 3_200_000, currency: 'COP', stock: 20 },
    { id: 'huila-washed-500', sizeGrams: 500, priceInCents: 5_800_000, currency: 'COP', stock: 3 },
  ],
};

const setup = (over: Partial<Parameters<typeof CoffeeCard>[0]> = {}) => {
  const props = {
    product,
    variantId: 'huila-washed-250',
    quantity: 2,
    maxQuantity: 10,
    eager: false,
    onVariantChange: jest.fn(),
    onQuantityChange: jest.fn(),
    onPay: jest.fn(),
    ...over,
  };
  render(<CoffeeCard {...props} />);
  return props;
};

describe('CoffeeCard', () => {
  it('shows the name, the tasting notes, the price for the chosen quantity and the stock', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Huila Lavado' })).toBeInTheDocument();
    expect(screen.getByText('Caramel, red apple and a clean, sweet finish.')).toBeInTheDocument();
    expect(screen.getByTestId('coffee-total')).toHaveTextContent('$64.000');
    expect(screen.getByText('20 disponibles')).toBeInTheDocument();
  });

  it('warns about fees before the summary so the total is never a surprise', () => {
    setup();
    expect(
      screen.getByText('La tarifa base y el envío se suman en el resumen.'),
    ).toBeInTheDocument();
  });

  it('shows the stock of the selected size', () => {
    setup({ variantId: 'huila-washed-500', quantity: 1 });
    expect(screen.getByText('Quedan 3')).toBeInTheDocument();
    expect(screen.getByTestId('coffee-total')).toHaveTextContent('$58.000');
  });

  it('has an image with fixed dimensions that loads lazily, or eagerly for the first coffees', () => {
    setup();
    const lazy = document.querySelector('img')!;
    expect(lazy).toHaveAttribute('src', '/images/coffees/huila-washed.webp');
    expect(lazy).toHaveAttribute('width', '800');
    expect(lazy).toHaveAttribute('height', '600');
    expect(lazy).toHaveAttribute('loading', 'lazy');
    expect(lazy).toHaveAttribute('alt', '');
  });

  it('loads the first images eagerly', () => {
    setup({ eager: true });
    expect(document.querySelector('img')).toHaveAttribute('loading', 'eager');
  });

  it('starts the payment with the pay button', async () => {
    const props = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Pagar con tarjeta de crédito' }));
    expect(props.onPay).toHaveBeenCalledTimes(1);
  });

  it('cannot be paid when the selected size is sold out, and says why', () => {
    setup({
      product: {
        ...product,
        variants: [{ ...product.variants[0], stock: 0 }, product.variants[1]],
      },
      maxQuantity: 0,
    });
    expect(screen.getByRole('button', { name: 'Pagar con tarjeta de crédito' })).toBeDisabled();
    expect(screen.getByText('Agotado')).toBeInTheDocument();
  });

  it('shows hostile text as plain text', () => {
    setup({
      product: {
        ...product,
        name: '<img src=x onerror=alert(1)>',
        description: '<script>alert(1)</script>',
      },
    });
    expect(
      screen.getByRole('heading', { name: '<img src=x onerror=alert(1)>' }),
    ).toBeInTheDocument();
    expect(document.querySelectorAll('script, img[onerror]')).toHaveLength(0);
  });

  it('passes size and quantity changes up', async () => {
    const props = setup();
    await userEvent.click(screen.getByRole('radio', { name: /500 g/ }));
    expect(props.onVariantChange).toHaveBeenCalledWith('huila-washed-500');
    await userEvent.click(screen.getByRole('button', { name: 'Aumentar cantidad' }));
    expect(props.onQuantityChange).toHaveBeenCalledWith(3);
  });
});
