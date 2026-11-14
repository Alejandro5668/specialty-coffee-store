import './quantity-stepper.css';

type Props = { value: number; max: number; onChange: (next: number) => void };

export const QuantityStepper = ({ value, max, onChange }: Props) => (
  <div role="group" aria-label="Cantidad" className="stepper">
    <button
      type="button"
      className="stepper__button"
      aria-label="Disminuir cantidad"
      disabled={max < 1 || value <= 1}
      onClick={() => onChange(value - 1)}
    >
      <span aria-hidden="true">-</span>
    </button>
    <output className="stepper__value">{value}</output>
    <button
      type="button"
      className="stepper__button"
      aria-label="Aumentar cantidad"
      disabled={max < 1 || value >= max}
      onClick={() => onChange(value + 1)}
    >
      <span aria-hidden="true">+</span>
    </button>
  </div>
);
