import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VariantView } from '../../api/types';
import { QuantityStepper } from './QuantityStepper';
import { SizePicker } from './SizePicker';

const variants: VariantView[] = [
  { id: 'a-250', sizeGrams: 250, priceInCents: 3_200_000, currency: 'COP', stock: 4 },
  { id: 'a-500', sizeGrams: 500, priceInCents: 5_800_000, currency: 'COP', stock: 0 },
];

describe('SizePicker', () => {
  it('offers each size with its price and marks the selected one', () => {
    render(<SizePicker name="a" variants={variants} value="a-250" onChange={jest.fn()} />);
    expect(screen.getByRole('radiogroup', { name: 'Size' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /250 g.*\$32\.000/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /500 g/ })).not.toBeChecked();
  });

  it('says in words that a size is sold out and does not let it be chosen', () => {
    render(<SizePicker name="a" variants={variants} value="a-250" onChange={jest.fn()} />);
    const soldOut = screen.getByRole('radio', { name: /500 g.*sold out/i });
    expect(soldOut).toBeDisabled();
  });

  it('never paints a sold out size as the chosen one, so its text stays readable', () => {
    const allGone = variants.map((v) => ({ ...v, stock: 0 }));
    render(<SizePicker name="a" variants={allGone} value="a-250" onChange={jest.fn()} />);
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio.closest('label')).not.toHaveClass('size--on');
      expect(radio.closest('label')).toHaveClass('size--off');
    }
  });

  it('reports the size the shopper picks', async () => {
    const onChange = jest.fn();
    const two = variants.map((v) => ({ ...v, stock: 3 }));
    render(<SizePicker name="a" variants={two} value="a-250" onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: /500 g/ }));
    expect(onChange).toHaveBeenCalledWith('a-500');
  });
});

describe('QuantityStepper', () => {
  it('shows the quantity and asks for the next one', async () => {
    const onChange = jest.fn();
    render(<QuantityStepper value={2} max={5} onChange={onChange} />);
    expect(screen.getByRole('status')).toHaveTextContent('2');
    await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(onChange).toHaveBeenLastCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: 'Decrease quantity' }));
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('cannot go below one', () => {
    render(<QuantityStepper value={1} max={5} onChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();
  });

  it('cannot go above the maximum', () => {
    render(<QuantityStepper value={5} max={5} onChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
  });

  it('is fully disabled when there is nothing to buy', () => {
    render(<QuantityStepper value={1} max={0} onChange={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();
  });
});
