import { TransactionView } from '../../../api/types';
import { Button } from '../../../ui/atoms/Button';
import { AmountLines } from '../../../ui/molecules/AmountLines';
import './order-status.css';

type Summary = {
  coffee: string | null;
  sizeGrams: number | null;
  quantity: number;
  amounts: TransactionView['amounts'];
  reference: string;
};

type Common = { onBack: () => void };
/** Seconds left before the page returns to the coffees by itself, and how to stay. */
type Leaving = { returnIn: number | null; onStay: () => void };
type Props =
  | { kind: 'checking' }
  | ({ kind: 'problem'; message: string; canRetry: boolean; onRetry: () => void } & Common)
  | ({ kind: 'slow'; summary: Summary; onCheckAgain: () => void } & Common)
  | ({ kind: 'confirming'; summary: Summary } & Common)
  | ({ kind: 'approved'; summary: Summary } & Common & Leaving)
  | ({ kind: 'declined' | 'error'; summary: Summary; onTryAnotherCard: () => void } & Common &
      Leaving);

const WORDS = {
  confirming: [
    'We are confirming your payment',
    'This usually takes a few seconds. Keep this page open.',
  ],
  slow: [
    'Your payment is still being confirmed',
    'It is taking longer than usual. Your order is reserved. Check again in a moment.',
  ],
  approved: [
    'Payment approved',
    'Thank you! We received your payment and your order is confirmed.',
  ],
  declined: [
    'Your card was declined',
    'Nothing was charged. Try another card, or check with your bank.',
  ],
  error: [
    'We could not complete the payment',
    'Nothing was charged. Try again in a moment, or use another card.',
  ],
} as const;

const label = ({ coffee, sizeGrams, quantity }: Summary): string =>
  coffee && sizeGrams ? `${coffee}, ${sizeGrams} g × ${quantity}` : `Your coffee × ${quantity}`;

export const OrderStatusView = (props: Props) => {
  if (props.kind === 'checking') {
    return (
      <p role="status" aria-live="polite">
        Checking your order…
      </p>
    );
  }

  if (props.kind === 'problem') {
    return (
      <div role="alert" className="stack">
        <p>{props.message}</p>
        {props.canRetry && (
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

  const [title, text] = WORDS[props.kind];
  const { summary } = props;
  return (
    <div className="order stack">
      {/* One live region, so a screen reader announces each change of status. */}
      <div role="status" aria-live="polite" className="stack">
        <h1 className="display page-title">{title}</h1>
        <p>{text}</p>
      </div>

      <AmountLines
        label={label(summary)}
        productInCents={summary.amounts.productAmountInCents}
        baseFeeInCents={summary.amounts.baseFeeInCents}
        deliveryFeeInCents={summary.amounts.deliveryFeeInCents}
        totalInCents={summary.amounts.totalInCents}
      />
      <p className="order__reference">Order reference: {summary.reference}</p>

      {props.kind === 'slow' && (
        <Button block onClick={props.onCheckAgain}>
          Check again
        </Button>
      )}
      {(props.kind === 'declined' || props.kind === 'error') && (
        <Button block onClick={props.onTryAnotherCard}>
          Try another card
        </Button>
      )}
      {'returnIn' in props && props.returnIn !== null && (
        <div className="order__return stack">
          {/* A timer is not announced every second; the result above already was. */}
          <p role="timer">
            Returning to the coffees in {props.returnIn}{' '}
            {props.returnIn === 1 ? 'second' : 'seconds'}.
          </p>
          <Button block variant="quiet" onClick={props.onStay}>
            Stay on this page
          </Button>
        </div>
      )}
      {props.kind !== 'confirming' && props.kind !== 'slow' && (
        <Button
          block
          variant={props.kind === 'approved' ? 'primary' : 'quiet'}
          onClick={props.onBack}
        >
          Back to the coffees
        </Button>
      )}
    </div>
  );
};
