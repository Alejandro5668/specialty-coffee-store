import { formatCop } from '../../lib/money';
import './amount-lines.css';

type Props = {
  label: string;
  productInCents: number;
  baseFeeInCents: number;
  deliveryFeeInCents: number;
  totalInCents: number;
};

/** The coffee, the two fees and the total, one per line. */
export const AmountLines = ({
  label,
  productInCents,
  baseFeeInCents,
  deliveryFeeInCents,
  totalInCents,
}: Props) => (
  <dl className="amounts">
    <div>
      <dt>{label}</dt>
      <dd data-testid="line-product">{formatCop(productInCents)}</dd>
    </div>
    <div>
      <dt>Base fee</dt>
      <dd data-testid="line-base">{formatCop(baseFeeInCents)}</dd>
    </div>
    <div>
      <dt>Delivery</dt>
      <dd data-testid="line-delivery">{formatCop(deliveryFeeInCents)}</dd>
    </div>
    <div className="amounts__total">
      <dt>Total</dt>
      <dd data-testid="line-total">{formatCop(totalInCents)}</dd>
    </div>
  </dl>
);
