import { formatCop } from '../../../lib/money';
import { Button } from '../../../ui/atoms/Button';
import { Totals } from '../lib/amounts';
import './summary-sheet.css';

type Ready = {
  state: 'ready';
  coffee: string;
  sizeGrams: number;
  quantity: number;
  totals: Totals;
  payment: string;
  recipient: string;
  address: string;
  paying: boolean;
  error: string | null;
  onPay: () => void;
  onEdit: () => void;
  onBack: () => void;
};

type Props =
  | { state: 'loading' }
  | { state: 'blocked'; message: string; onRetry?: () => void; onBack: () => void }
  | Ready;

export const SummarySheet = (props: Props) => {
  if (props.state === 'loading') {
    return (
      <p role="status" aria-live="polite">
        Loading your order…
      </p>
    );
  }

  if (props.state === 'blocked') {
    return (
      <div role="alert" className="stack">
        <p>{props.message}</p>
        {props.onRetry && (
          <Button block onClick={props.onRetry}>
            Try again
          </Button>
        )}
        <Button block variant="quiet" onClick={props.onBack}>
          Back to the coffees
        </Button>
      </div>
    );
  }

  const { totals } = props;
  return (
    <div className="summary stack">
      {props.error && (
        <div role="alert" className="notice notice--error stack">
          <p>{props.error}</p>
          <Button variant="quiet" onClick={props.onBack}>
            Back to the coffees
          </Button>
        </div>
      )}

      <dl className="summary__lines">
        <div>
          <dt>
            {props.coffee}, {props.sizeGrams} g × {props.quantity}
          </dt>
          <dd data-testid="line-product">{formatCop(totals.productInCents)}</dd>
        </div>
        <div>
          <dt>Base fee</dt>
          <dd data-testid="line-base">{formatCop(totals.baseFeeInCents)}</dd>
        </div>
        <div>
          <dt>Delivery</dt>
          <dd data-testid="line-delivery">{formatCop(totals.deliveryFeeInCents)}</dd>
        </div>
        <div className="summary__total">
          <dt>Total</dt>
          <dd data-testid="line-total">{formatCop(totals.totalInCents)}</dd>
        </div>
      </dl>

      <section className="summary__block">
        <h3>Payment</h3>
        <p>{props.payment}</p>
      </section>
      <section className="summary__block">
        <h3>Delivery</h3>
        <p>{props.recipient}</p>
        <p>{props.address}</p>
      </section>

      <Button block disabled={props.paying} onClick={props.onPay}>
        {props.paying ? 'Paying…' : `Pay ${formatCop(totals.totalInCents)}`}
      </Button>
      <Button block variant="quiet" onClick={props.onEdit}>
        Edit details
      </Button>
    </div>
  );
};
