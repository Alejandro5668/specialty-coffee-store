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
    'Estamos confirmando tu pago',
    'Suele tardar unos segundos. Mantén esta página abierta.',
  ],
  slow: [
    'Tu pago aún se está confirmando',
    'Está tardando más de lo habitual. Tu pedido está reservado. Vuelve a consultar en un momento.',
  ],
  approved: ['Pago aprobado', '¡Gracias! Recibimos tu pago y tu pedido está confirmado.'],
  declined: [
    'Tu tarjeta fue rechazada',
    'No se hizo ningún cobro. Prueba con otra tarjeta o consulta con tu banco.',
  ],
  error: [
    'No pudimos completar el pago',
    'No se hizo ningún cobro. Inténtalo de nuevo en un momento o usa otra tarjeta.',
  ],
} as const;

const label = ({ coffee, sizeGrams, quantity }: Summary): string =>
  coffee && sizeGrams ? `${coffee}, ${sizeGrams} g × ${quantity}` : `Tu café × ${quantity}`;

export const OrderStatusView = (props: Props) => {
  if (props.kind === 'checking') {
    return (
      <p role="status" aria-live="polite">
        Consultando tu pedido…
      </p>
    );
  }

  if (props.kind === 'problem') {
    return (
      <div role="alert" className="stack">
        <p>{props.message}</p>
        {props.canRetry && (
          <Button block onClick={props.onRetry}>
            Intentar de nuevo
          </Button>
        )}
        <Button block variant="quiet" onClick={props.onBack}>
          Volver a los cafés
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
      <p className="order__reference">Referencia del pedido: {summary.reference}</p>

      {props.kind === 'slow' && (
        <Button block onClick={props.onCheckAgain}>
          Consultar de nuevo
        </Button>
      )}
      {(props.kind === 'declined' || props.kind === 'error') && (
        <Button block onClick={props.onTryAnotherCard}>
          Probar con otra tarjeta
        </Button>
      )}
      {'returnIn' in props && props.returnIn !== null && (
        <div className="order__return stack">
          {/* A timer is not announced every second; the result above already was. */}
          <p role="timer">
            Volviendo a los cafés en {props.returnIn}{' '}
            {props.returnIn === 1 ? 'segundo' : 'segundos'}.
          </p>
          <Button block variant="quiet" onClick={props.onStay}>
            Quedarme en esta página
          </Button>
        </div>
      )}
      {props.kind !== 'confirming' && props.kind !== 'slow' && (
        <Button
          block
          variant={props.kind === 'approved' ? 'primary' : 'quiet'}
          onClick={props.onBack}
        >
          Volver a los cafés
        </Button>
      )}
    </div>
  );
};
